import "./globals.css";

export const metadata = {
  title: "Skillister — skill discovery that works at a thousand skills",
  description:
    "Index, rank, route and benchmark agent skills across any agent CLI. Live registry, reproducible pack scores, no vendoring.",
  openGraph: {
    title: "Skillister",
    description: "You have hundreds of agent skills installed. Your agent uses about six of them.",
    url: "https://skillister.vercel.app",
    siteName: "Skillister",
    type: "website",
  },
};

export const viewport = { themeColor: "#101010" };

function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <a href="/" className="wordmark">Skillister</a>
        <div className="nav-links">
          <a href="/#registry">Registry</a>
          <a href="/#benchmarks">Benchmarks</a>
          <a href="/discover">Discover</a>
          <a href="/#install">Install</a>
        </div>
        <a className="pill" href="https://github.com/vaibhav4046/skillister">
          GitHub <span aria-hidden="true">↗</span>
        </a>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer>
      <div className="wrap foot-inner">
        <span className="meta">Skillister · MIT</span>
        <span className="meta">
          Indexed packs stay under their own licences, held by their own authors
        </span>
        <a className="meta chalk" href="https://github.com/vaibhav4046/skillister">
          github.com/vaibhav4046/skillister
        </a>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=JetBrains+Mono:wght@400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
