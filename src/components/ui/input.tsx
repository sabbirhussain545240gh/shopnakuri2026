import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, value, onChange, placeholder, ...props }, ref) => {
    // Determine if we should show a calendar picker
    // We target text inputs that look like date fields (have "date" in name/placeholder or are explicitly used for dates)
    const isDateField = type === "text" && (
      (typeof placeholder === 'string' && (placeholder.includes('/') || placeholder.toLowerCase().includes('date') || placeholder.includes('DD'))) ||
      (props.name && props.name.toLowerCase().includes('date')) ||
      (props.id && props.id.toLowerCase().includes('date'))
    );

    if (isDateField) {
      // Try to parse the value
      let dateValue: Date | undefined = undefined;
      const strValue = String(value || "");
      if (strValue) {
        // Handle YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(strValue)) {
          const d = parseISO(strValue);
          if (isValid(d)) dateValue = d;
        } else {
          // Handle other formats if possible, but keep it simple
          const d = new Date(strValue);
          if (isValid(d)) dateValue = d;
        }
      }

      return (
        <div className="relative flex w-full">
          <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-10 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            )}
            ref={ref}
            {...props}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-9 w-9 rounded-l-none text-muted-foreground hover:text-foreground focus-visible:ring-0"
              >
                <CalendarIcon className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateValue}
                onSelect={(date) => {
                  if (date && onChange) {
                    // Format back to YYYY-MM-DD which is what the app's store expect via toIsoDate
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const iso = `${year}-${month}-${day}`;
                    
                    // Create a synthetic event
                    const event = {
                      target: { value: iso },
                      currentTarget: { value: iso }
                    } as React.ChangeEvent<HTMLInputElement>;
                    
                    onChange(event);
                  }
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={value}
        onChange={onChange}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
