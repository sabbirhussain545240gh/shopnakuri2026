import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  listAllRoles,
  assignRoleByEmail,
  removeRoleAssignment,
  type AppRole,
} from "@/lib/roles.functions";
import { roleLabel } from "@/lib/permissions";

type Row = { id: string; userId: string; email: string; role: AppRole; createdAt: string };

const ASSIGNABLE: AppRole[] = ["treasurer", "president", "secretary", "member", "admin"];

export function RoleManager() {
  const fetchAll = useServerFn(listAllRoles);
  const assign = useServerFn(assignRoleByEmail);
  const remove = useServerFn(removeRoleAssignment);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("treasurer");
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetchAll();
      setRows(r.assignments as Row[]);
    } catch (e: any) {
      toast.error(e?.message ?? "ভূমিকা লোড করা যায়নি");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    try {
      await assign({ data: { email: email.trim(), role } });
      toast.success(`${roleLabel(role)} ভূমিকা যোগ হয়েছে`);
      setEmail("");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "ভূমিকা বরাদ্দ করা যায়নি");
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = async (id: string) => {
    setRemovingId(id);
    try {
      await remove({ data: { id } });
      toast.success("ভূমিকা সরানো হয়েছে");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "সরানো যায়নি");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" /> ভূমিকা ব্যবস্থাপনা
        </CardTitle>
        <CardDescription>
          ইউজারের ইমেইল দিয়ে ভূমিকা বরাদ্দ করুন। ইউজার আগে ইনভাইট গ্রহণ করে অ্যাকাউন্ট তৈরি করে থাকতে হবে।
          <br />
          <span className="text-xs">
            • সুপার এডমিন: সব • কোষাধ্যক্ষ: লেনদেন/জমা/ঋণ এডিট • সভাপতি ও সাধারণ সম্পাদক: দেখা + নোটিশ/বাণী এডিট • সদস্য: শুধু ড্যাশবোর্ড ও রিপোর্ট
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onAssign} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="role-email">ইউজার ইমেইল</Label>
            <Input id="role-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="space-y-1.5">
            <Label>ভূমিকা</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ASSIGNABLE.map((r) => (
                  <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} যোগ করুন
          </Button>
        </form>

        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
            বরাদ্দকৃত ভূমিকা ({rows.length})
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">কোনো ভূমিকা বরাদ্দ নেই</div>
          ) : (
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.email || r.userId}</div>
                    <div className="text-xs text-muted-foreground">{roleLabel(r.role)}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => onRemove(r.id)}
                    disabled={removingId === r.id}>
                    {removingId === r.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
