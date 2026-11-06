import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-900/60 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/img/logo.svg" alt="Route 66" className="h-10 w-10" />
          <div className="leading-tight">
            <div className="text-sm font-bold">Route 66</div>
            <div className="text-[11px] text-white/50">Enjoy it your way</div>
          </div>
        </Link>
        <nav className="flex items-center gap-1.5 text-sm">
          <Link href="/menu" className="rounded-xl px-3 py-2 text-white/75 hover:bg-white/5 hover:text-white">المنيو</Link>
          <Link href="/book" className="btn-neon px-4 py-2">احجز طاولة</Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter({ phone, address }: { phone: string; address: string }) {
  return (
    <footer className="mt-16 border-t border-white/5 bg-ink-900">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-white/60 sm:grid-cols-3">
        <div>
          <div className="mb-2 font-bold text-white">Route 66</div>
          <div>كافيه ومطعم</div>
          <div className="mt-1">{address}</div>
        </div>
        <div>
          <div className="mb-2 font-bold text-white">للحجز والاستفسار</div>
          <a href={`tel:${phone}`} className="num text-white hover:text-neon">{phone}</a>
        </div>
        <div>
          <div className="mb-2 font-bold text-white">تابعونا</div>
          <a href="https://www.instagram.com/route66_cafe_/" target="_blank" rel="noreferrer" className="hover:text-white" dir="ltr">Instagram @route66_cafe_</a>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-[11px] text-white/30">
        Powered by Solunera · @soluneragency
      </div>
    </footer>
  );
}
