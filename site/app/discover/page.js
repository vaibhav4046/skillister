import { discover, ago, num } from "../../lib/data";

export const revalidate = 1800;

export const metadata = {
  title: "Discover — Skillister",
  description: "Verified agent skill packs not yet in the registry, with real skill counts.",
};

export default async function Discover() {
  const { items, generated } = await discover();

  return (
    <main>
      <section>
        <div className="wrap">
          <span className="badge" style={{ marginBottom: 40 }}>
            <span className="dot" aria-hidden="true" />
            Verified {generated ? ago(generated) : "not yet"} · refreshed weekly by workflow
          </span>

          <h1 className="display" style={{ maxWidth: 880 }}>
            Every pack that exists, checked for whether it contains any skills at all.
          </h1>

          <p className="sub" style={{ maxWidth: 660, marginTop: 32 }}>
            Searching GitHub for &ldquo;agent skills&rdquo; returns LLM platforms, admin dashboards
            and study guides whose READMEs merely use the words. The only reliable signal is whether
            a repository actually ships SKILL.md files.
          </p>

          <p className="body" style={{ maxWidth: 660, marginTop: 24 }}>
            So each repository below was checked through the git tree API and the count is real. A
            weekly workflow refreshes it. Nothing here is endorsed, and a high star count is not a
            recommendation: several of the largest repositories in this space are bulk dumps that
            make discovery worse. Run{" "}
            <span className="chalk">skillister audit &lt;owner/repo&gt;</span> before you install
            anything.
          </p>
        </div>
      </section>

      <hr className="rule" />

      <section>
        <div className="wrap">
          <span className="section-label">
            {items.length} verified pack{items.length === 1 ? "" : "s"}
          </span>

          {items.length === 0 ? (
            <p className="body">
              No candidate data yet. The weekly discovery workflow writes it; run{" "}
              <span className="chalk">node scripts/discover.mjs</span> locally to generate it now.
            </p>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Repository</th>
                    <th>Skills</th>
                    <th>Stars</th>
                    <th>Licence</th>
                    <th>Last push</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r) => (
                    <tr key={r.repo}>
                      <td>
                        <a href={r.url} className="chalk">{r.repo}</a>
                        <div className="meta" style={{ textTransform: "none", marginTop: 6, maxWidth: 440 }}>
                          {r.description}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          {(r.flags || []).map((f) => (
                            <span className="tag" key={f}>
                              {f.replace(/\*\*/g, "")}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="num">{r.skills}</td>
                      <td className="num">{num(r.stars)}</td>
                      <td className="num">{r.license}</td>
                      <td className="num">{r.updated || "-"}</td>
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
