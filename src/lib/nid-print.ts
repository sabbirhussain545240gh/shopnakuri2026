import { Member } from "./samiti-store";

export function printNidFile(fileData: string, label: string, ownerName: string, samitiName: string, logo?: string, isGuarantor: boolean = false) {
  const win = window.open("", "_blank");
  if (!win) return;

  const isPdf = fileData.startsWith("data:application/pdf") || fileData.toLowerCase().endsWith(".pdf");

  win.document.write(`
    <html>
      <head>
        <title>${label} - ${ownerName}</title>
        <style>
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Hind Siliguri', 'Noto Sans Bengali', Arial, sans-serif;
            color: #333;
            background-color: white;
          }
          .container {
            max-width: 100%;
            margin: 0 auto;
            position: relative;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 20px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
            margin-bottom: 25px;
            text-align: center;
          }
          .header img {
            height: 60px;
            width: 60px;
            object-fit: contain;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #111;
          }
          .doc-info {
            text-align: center;
            margin-bottom: 30px;
          }
          .doc-info h2 {
            margin: 0;
            font-size: 18px;
            background: #f4f4f4;
            display: inline-block;
            padding: 5px 20px;
            border-radius: 4px;
            border: 1px solid #ddd;
          }
          .doc-info p {
            margin: 5px 0 0;
            font-size: 14px;
            color: #666;
          }
          .file-container {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          .file-container img {
            max-width: 100%;
            max-height: 800px;
            object-fit: contain;
            border: 1px solid #eee;
            box-shadow: 0 0 10px rgba(0,0,0,0.05);
          }
          .pdf-hint {
            padding: 40px;
            text-align: center;
            border: 2px dashed #ccc;
            border-radius: 8px;
            color: #555;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60%;
            height: auto;
            opacity: 0.08;
            z-index: -1;
            pointer-events: none;
          }
          @media print {
            .no-print { display: none; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          .footer-note {
            position: fixed;
            bottom: 20px;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 10px;
            color: #999;
            border-top: 1px solid #eee;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          ${logo ? `<img src="${logo}" class="watermark" />` : ""}
          <div class="header">
            ${logo ? `<img src="${logo}" />` : ""}
            <div>
              <h1>${samitiName}</h1>
            </div>
          </div>
          
          <div class="doc-info">
            <h2>${label}</h2>
            <p>${isGuarantor ? 'জামিনদারের নাম' : 'সদস্যের নাম'}: ${ownerName}</p>
          </div>

          <div class="file-container">
            ${isPdf ? `
              <div class="pdf-hint">
                <p>এটি একটি PDF ফাইল। এটি প্রিন্ট করার জন্য ব্রাউজারের PDF ভিউয়ার ব্যবহার করুন অথবা নিচের বাটনে ক্লিক করুন।</p>
                <a href="${fileData}" target="_blank" style="display:inline-block;padding:10px 20px;background:#007bff;color:white;text-decoration:none;border-radius:4px;margin-top:10px;">PDF ফাইলটি খুলুন</a>
              </div>
            ` : `
              <img src="${fileData}" onload="window.print()" />
            `}
          </div>

          <div class="footer-note">
            এটি একটি সিস্টেম জেনারেটেড ডকুমেন্ট | ${new Date().toLocaleDateString('bn-BD')}
          </div>
        </div>
      </body>
    </html>
  `);

  win.document.close();
}
