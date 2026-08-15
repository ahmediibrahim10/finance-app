// تحويل المبلغ المكتوب من المستخدم (ريال/جنيه) للوحدة الصغرى (هللات/قروش) قبل التخزين
export function toMinorUnits(amountStr: string | number): number {
  const str = String(amountStr).trim();
  if (!str || isNaN(Number(str)) || Number(str) < 0 || str === "Infinity") {
    throw new Error("Invalid amount");
  }

  const parts = str.split('.');
  const intPart = parseInt(parts[0], 10) * 100;
  let decPart = 0;

  if (parts[1]) {
    // نأخذ أول رقمين فقط بعد الفاصلة
    decPart = parseInt((parts[1] + '00').substring(0, 2), 10);
  }

  return intPart + decPart;
}

// تحويل المبلغ من الوحدة الصغرى (هللات/قروش) لنص جاهز للعرض بالوحدة الكبرى (ريال/جنيه)
export function formatMinorUnits(amountMinor: number, fractionDigits = 2): string {
  return (amountMinor / 100).toFixed(fractionDigits);
}