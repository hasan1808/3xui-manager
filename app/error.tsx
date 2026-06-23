"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      <div className="text-center space-y-4 p-8">
        <h1 className="text-6xl font-bold text-red-500">!</h1>
        <h2 className="text-xl font-semibold">خطایی رخ داد</h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>در پردازش درخواست شما مشکلی پیش آمد</p>
        <button onClick={reset}
          className="bg-blue-600 hover:bg-blue-700 px-6 py-2.5 rounded transition text-sm">
          تلاش مجدد
        </button>
      </div>
    </div>
  );
}
