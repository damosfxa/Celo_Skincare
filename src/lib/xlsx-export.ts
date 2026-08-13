import ExcelJS from "exceljs";

/**
 * Bikin file Excel asli (.xlsx) dari header + baris data, lalu langsung
 * men-download-nya lewat browser. Upgrade dari Export CSV: file .xlsx
 * beneran punya info lebar kolom di dalamnya, jadi begitu dibuka di
 * Excel/WPS langsung rapi, tanpa perlu dobel-klik menyesuaikan lebar
 * kolom manual seperti CSV (CSV cuma teks polos, sama sekali tidak bisa
 * menyimpan info lebar kolom).
 *
 * Dipakai bareng oleh halaman Ledger, Retur, dan Opname, supaya cara
 * exportnya konsisten.
 */
export async function downloadXlsx(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");

  sheet.columns = headers.map((header) => ({ header, key: header }));
  rows.forEach((row) => sheet.addRow(row));

  // Lebar tiap kolom disesuaikan otomatis dari isi terpanjang di kolom
  // itu (nama headernya ATAU datanya, mana yang lebih panjang).
  sheet.columns.forEach((column, i) => {
    let maxLength = headers[i]?.length ?? 10;
    rows.forEach((row) => {
      const len = String(row[i] ?? "").length;
      if (len > maxLength) maxLength = len;
    });
    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
  });

  // Baris header ditebalkan, biar gampang dibedain dari baris data.
  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
