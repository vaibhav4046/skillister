import { getPacks, discover, ago, num } from "../../lib/data";

export const revalidate = 3600;

export const metadata = {
  title: "Discover — Skillister",
  description: "Live GitHub search for agent skill packs not yet in the registry.",
};

export default async function Discover() {
  const { packs, rejected } = await getPacks();
  const known = new Set([...packs.map((p) => p.repo), ...(rejected || []).map((r) => r.repo)].map((r) => r.toLowerCase()));
  const found = await discover(known);

  return (
    <main>
      <section>
        <div className="wrap">
          <span className="badge" style={{ marginBottom: 40 }}>
            <span className="dot" aria-hidden="true" />
            Live GitHub search · refreshed hourly
          </span>

          <h1 className="display" style={{ maxWidth: 860 }}>
            Everything that exists right now, not a list frozen at build time.
          </h1>

          <p className="sub" style={{ maxWidth: 640, marginTop: 32 }}>
            Searched against GitHub on request. These are skill repositories with at least 150 stars
            that are not yet in the registry, and not yet rejected. Nothing here is endorsed.
          </p>

          <p className="body" style={{ maxWidth: 640, marginTop: 24 }}>
            A high star count is not a recommendation. Several of the largest repositories in this
            space are bulk dumps that make discovery worse. Run{" "}
            <span className="chalk">skillister audit &lt;owner/repo&gt;</span> on anything below to
            get a reproducible score before you install it.
          </p>
        </div>
      </section>

      <hr className="rule" />

      <section>
        <div className="wrap">
          <span className="section-label">
            {found.length} candidate{found.length === 1 ? "" : "s"}
          </span>

          {found.length === 0 ? (
            <p className="body">
              GitHub returned nothing usable. The unauthenticated search API allows 10 requests per
              minute across all visitors, so this is most likely a rate limit rather than an empty
              result. Set GITHUB_TOKEN in the deployment to raise it.
            </p>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Stars</th>
                    <th>Licence</th>
                    <th>Last push</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {found.map((r) => (
                    <tr key={r.repo}>
                      <td>
                        <a href={r.url} className="chalk">{r.repo}</a>
                        <div className="meta" style={{ textTransform: "none", marginTop: 6, maxWidth: 420 }}>
                          {r.description}
                        </div>
                        {r.license === "NONE" && (
                          <span className="tag" style={{ marginTop: 8 }}>no licence — all rights reserved</span>
                        )}
                        {/^(CC-BY-SA|GPL|AGPL)/.test(r.license) && (
                          <span className="tag" style={{ marginTop: 8 }}>copyleft — link, do not vendor</span>
                        )}
                      </td>
                      <td className="num">{num(r.stars)}</td>
                      <td className="num">{r.license}</td>
                      <td className="num">{ago(r.pushedAt)}</td>
                      <td className="num">skillister audit {r.repo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 40 }}>
            <a className="pill" href="https://github.com/vaibhav4046/skillister/blob/main/CONTRIBUTING.md">
              Propose one <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
