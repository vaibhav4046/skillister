import { getPacks, getRoutes, getBenchmarks, getRepos, ago, num, REVALIDATE } from "../lib/data";

export const revalidate = 1800;

function Bar({ value }) {
  return (
    <div className="bar" title={`${value}/100`}>
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export default async function Home() {
  const [{ packs, rejected }, { routes }, bench] = await Promise.all([getPacks(), getRoutes(), getBenchmarks()]);
  const live = await getRepos(packs.map((p) => p.repo));

  const benchById = Object.fromEntries((bench.packs || []).map((b) => [b.id, b]));
  const ranked = [...packs]
    .map((p) => ({ ...p, bench: benchById[p.id], live: live[p.repo] }))
    .sort((a, b) => (b.bench?.score || 0) - (a.bench?.score || 0));

  const totalSkills = (bench.packs || []).reduce((n, b) => n + (b.skills || 0), 0);
  const totalStars = Object.values(live).reduce((n, r) => n + (r.stars || 0), 0);
  const evalCount = routes.reduce((n, r) => n + (r.evals?.should?.length || 0) + (r.evals?.shouldNot?.length || 0), 0);

  return (
    <main>
      {/* ---------------------------------------------------------- hero */}
      <section style={{ paddingBottom: 0 }}>
        <div className="wrap">
          <span className="badge" style={{ marginBottom: 40 }}>
            <span className="dot" aria-hidden="true" />
            Live · {packs.length} packs tracked · refreshed every {Math.round(REVALIDATE / 60)} min
          </span>

          <h1 className="display" style={{ maxWidth: 940 }}>
            You have hundreds of agent skills installed. Your agent uses about six of them.
          </h1>

          <p className="sub" style={{ maxWidth: 640, marginTop: 32 }}>
            Skills are matched to a request by their description. That works at twenty skills. At a
            thousand it stops working, and the pack you installed last week never fires again.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 40, flexWrap: "wrap" }}>
            <a className="pill" href="#install">Install <span aria-hidden="true">↗</span></a>
            <a className="ghost" href="/discover">Discover packs</a>
          </div>
        </div>
      </section>

      <section style={{ paddingTop: 80 }}>
        <div className="wrap">
          <div className="grid-2">
            <div>
              <span className="stat-n">{num(totalSkills)}</span>
              <span className="meta">skills measured</span>
            </div>
            <div>
              <span className="stat-n">{packs.length}</span>
              <span className="meta">packs in the registry</span>
            </div>
            <div>
              <span className="stat-n">{routes.length}</span>
              <span className="meta">routes, {evalCount} prompt evals</span>
            </div>
            <div>
              <span className="stat-n">{num(totalStars)}</span>
              <span className="meta">upstream stars represented</span>
            </div>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ---------------------------------------------------- benchmarks */}
      <section id="benchmarks">
        <div className="wrap">
          <span className="section-label">01 — Benchmarks</span>
          <h2 className="heading" style={{ maxWidth: 720 }}>
            Stars measure popularity. They do not tell you whether the skills load.
          </h2>
          <p className="body" style={{ maxWidth: 640, marginTop: 24 }}>
            Every pack is cloned and measured on things that can be checked: does the frontmatter
            parse, is the description specific enough to route on, does it say when to use it, do
            names match directories, are there duplicates, how much context does an average skill
            cost. Same commit in, same score out. Nothing here asks a model.
          </p>

          <div className="scroll-x" style={{ marginTop: 40 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Pack</th>
                  <th>Score</th>
                  <th>Skills</th>
                  <th>Stars</th>
                  <th>Licence</th>
                  <th>Last push</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={`https://github.com/${p.repo}`} className="chalk">{p.repo}</a>
                      <div className="meta" style={{ textTransform: "none", marginTop: 6, maxWidth: 380 }}>
                        {p.summary}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Bar value={p.bench?.score || 0} />
                        <span className="num">{p.bench?.score ?? "-"}</span>
                      </div>
                    </td>
                    <td className="num">{p.bench?.skills ?? "-"}</td>
                    <td className="num">{num(p.live?.stars)}</td>
                    <td className="num">{p.license}</td>
                    <td className="num">{ago(p.live?.pushedAt)}</td>
                    <td className="meta" style={{ textTransform: "none" }}>{p.bench?.verdict ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="meta" style={{ marginTop: 16, textTransform: "none" }}>
            Scores generated {bench.generated ? ago(bench.generated) : "not yet"} · star counts and
            push dates are live from the GitHub API · reproduce any row with{" "}
            <span className="chalk">skillister audit &lt;owner/repo&gt;</span>
          </p>
        </div>
      </section>

      <hr className="rule" />

      {/* ------------------------------------------------------- ranking */}
      <section>
        <div className="wrap">
          <span className="section-label">02 — Ranking</span>
          <h2 className="heading" style={{ maxWidth: 720 }}>
            A long name beats a precise one by accident. The prior fixes that.
          </h2>
          <p className="body" style={{ maxWidth: 640, marginTop: 24 }}>
            Naive matching counts how many query words appear in a skill&apos;s name and description.
            A five-word name contains more of your query than a two-word one without being a better
            answer, so a thousand-skill pack wins every search it enters. Skillister weights how much
            of the name your query actually covers, then down-weights hits drawn from very large
            collections.
          </p>

          <div className="term" style={{ marginTop: 40 }}>
            <pre>
{`$ `}<span className="cmd">skillister compare open source a repo</span>{`

  naive (substring count)                  skillister (coverage + prior)
  --------------------------------------   --------------------------------------
  collecting-open-source-intelligence      `}<span className="win">open-sourcing</span>{`
  performing-open-source-intelligence...   collecting-open-source-intelligence
  `}<span className="win">open-sourcing</span>{`                            performing-open-source-intelligence...

  `}<span className="gold">naive picked from "Anthropic-Cybersecurity-Skills" (753 skills),
  skillister picked from "open-sourcing" (1 skill).</span>{`
`}
            </pre>
          </div>

          <p className="body" style={{ maxWidth: 640, marginTop: 24 }}>
            The gain shows up on queries built from common words, which is exactly where a large
            pack&apos;s keyword-dense names crowd out a short precise one. On queries containing a
            distinctive term the two agree, because there was no ambiguity to resolve. Run{" "}
            <span className="chalk">skillister find --naive</span> against your own machine and judge
            it yourself.
          </p>
        </div>
      </section>

      <hr className="rule" />

      {/* -------------------------------------------------------- routes */}
      <section id="registry">
        <div className="wrap">
          <span className="section-label">03 — Routes</span>
          <h2 className="heading" style={{ maxWidth: 720 }}>
            {routes.length} routes, {evalCount} prompt evals, zero routes that point at nothing.
          </h2>
          <p className="body" style={{ maxWidth: 640, marginTop: 24 }}>
            A route maps a task shape to exact skill names. Each declares prompts that must fire it
            and prompts that must not, and CI runs all of them. It also asserts every routed name
            resolves in a real built index, so a route can never recommend a skill nobody installed.
          </p>

          <div className="scroll-x" style={{ marginTop: 40 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Shape</th>
                  <th>Skills</th>
                  <th>Fires on</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((r) => (
                  <tr key={r.id}>
                    <td className="chalk">{r.id}</td>
                    <td>{r.skills.map((s) => <span className="tag" key={s}>{s}</span>)}</td>
                    <td className="meta" style={{ textTransform: "none" }}>
                      &ldquo;{r.evals?.should?.[0]}&rdquo;
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ------------------------------------------------------ rejected */}
      <section>
        <div className="wrap">
          <span className="section-label">04 — Not listed</span>
          <h2 className="heading" style={{ maxWidth: 720 }}>
            Curation means saying no in public.
          </h2>
          <div className="grid-2" style={{ marginTop: 40 }}>
            {(rejected || []).map((r) => (
              <div key={r.repo}>
                <a href={`https://github.com/${r.repo}`} className="chalk" style={{ fontSize: 18 }}>
                  {r.repo}
                </a>
                <div className="meta" style={{ marginTop: 8 }}>{r.skills} skills</div>
                <p className="body" style={{ marginTop: 16, fontSize: 14 }}>{r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="rule" />

      {/* ------------------------------------------------------- install */}
      <section id="install">
        <div className="wrap">
          <span className="section-label">05 — Install</span>
          <h2 className="heading">Works with whatever you already run.</h2>

          <div className="term" style={{ marginTop: 40, maxWidth: 760 }}>
            <pre>
{`$ `}<span className="cmd">npm install -g skillister</span>{`
$ `}<span className="cmd">skillister index</span>{`
indexed 1203 skills from 6 roots

$ `}<span className="cmd">skillister route "the login page is broken"</span>{`
- "systematic-debugging" + "diagnosing-bugs" :: Hypothesis loop, no
  guess-patching. Find the root cause before editing.

$ `}<span className="cmd">skillister init claude-code</span>{`   # hooks
$ `}<span className="cmd">skillister init generic</span>{`       # AGENTS.md snippet
`}
            </pre>
          </div>

          <p className="body" style={{ maxWidth: 640, marginTop: 24 }}>
            Claude Code gets hooks that arm the index at session start and route every prompt. Codex,
            Cursor, Gemini CLI and opencode get an instruction snippet. One index serves every host
            CLI on the machine at once.
          </p>

          <div style={{ display: "flex", gap: 12, marginTop: 40, flexWrap: "wrap" }}>
            <a className="pill" href="https://github.com/vaibhav4046/skillister">
              Read the docs <span aria-hidden="true">↗</span>
            </a>
            <a className="ghost" href="https://github.com/vaibhav4046/skillister/blob/main/CONTRIBUTING.md">
              Contribute a pack
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
