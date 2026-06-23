import Link from "next/link";
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="text-center space-y-4 p-8">
        <h1 className="text-6xl font-bold text-gray-500">۴۰۴</h1>
        <h2 className="text-xl font-semibold">صفحه مورد نظر یافت نشد</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>آدرس وارد شده معتبر نیست</p>
        <Link href="/dashboard"
          className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded transition text-sm">
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  );
}
