export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAF7F4] via-[#F5EEE6] to-[#EDE3D8] dark:from-[#1C1714] dark:via-[#221E1A] dark:to-[#2A2220] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">P+</span>
          </div>
          <span className="text-2xl font-bold text-text-primary dark:text-stone-100">
            Precy<span className="text-primary">+</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
