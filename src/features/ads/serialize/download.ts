// 브라우저 Blob 다운로드(무료). 원본명 기반 -edited-YYYYMMDD.xlsx.
export function editedFileName(original: string, date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const stamp = `${y}${m}${d}`;
  const base = original.replace(/\.xlsx$/i, '');
  return `${base}-edited-${stamp}.xlsx`;
}

export function downloadXlsx(bytes: Uint8Array, fileName: string): void {
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
