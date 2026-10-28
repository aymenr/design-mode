/**
 * The tool's stylesheet. It lives inside the shadow root, so nothing here can leak
 * into the app and none of the app's styles can reach in.
 *
 * Neutral grey on purpose, so the tool never reads as part of the app it's
 * inspecting. Blue means "selected" or "the action" and nothing else.
 */
export const css = `
:host { all: initial; }
* { box-sizing: border-box; }
button { all: unset; box-sizing: border-box; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--blue); outline-offset: 1px; }

.root {
  --bg: #1c1c20;
  --bg-2: #25252b;
  --bg-3: #3a3a44;
  --line: #34343c;
  --text: #ecebef;
  --muted: #a3a1ab;
  --faint: #6c6a74;
  --blue: #4c8dff;
  --blue-soft: rgba(76, 141, 255, 0.16);
  --blue-text: #9cc0ff;
  --changed: #5fd08a;
  --component: #b69cff;
  --mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font: 12px/1.4 'DM Sans', system-ui, -apple-system, sans-serif;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
}
.icon { display: block; flex: none; }

/* ── Page overlay ─────────────────────────────── */
.box { position: fixed; pointer-events: none; border: 1.5px solid var(--blue); border-radius: 4px; display: none; }
.box.hover { border-style: dashed; background: rgba(76, 141, 255, 0.08); }
.box-tag { position: absolute; left: -1.5px; bottom: 100%; margin-bottom: 3px; white-space: nowrap; background: var(--blue); color: #fff; font: 500 11px var(--mono); padding: 2px 6px; border-radius: 4px; }
.box-tag.below { bottom: auto; top: 100%; margin: 3px 0 0; }
.box-tag em { font-style: normal; opacity: 0.75; margin-left: 6px; }

/* ── Launcher ─────────────────────────────────── */
.fab { position: fixed; display: flex; touch-action: none; height: 44px; border-radius: 22px; overflow: hidden; background: var(--bg); border: 1px solid var(--line); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35); }
.fab .main { width: 44px; display: grid; place-items: center; color: var(--text); }
.fab.on .main { background: var(--blue); color: #fff; }
.fab .more { width: 26px; display: grid; place-items: center; color: var(--muted); border-left: 1px solid var(--line); }
.fab .more:hover, .fab .main:hover { background: var(--bg-2); }
.fab.on .main:hover { background: var(--blue); }
.menu { position: fixed; width: 236px; background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 6px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); font-size: 13px; }
.menu .it { display: flex; width: 100%; align-items: center; gap: 10px; padding: 0 8px; height: 32px; border-radius: 6px; }
.menu .it:hover { background: var(--bg-2); }
.menu .it .icon { color: var(--muted); }
.menu .foot { border-top: 1px solid var(--line); margin-top: 4px; padding: 8px 8px 4px; font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
kbd { font: 11px var(--mono); color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 4px; margin-left: 2px; }

/* ── Select-mode hint ─────────────────────────── */
.hint { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); max-width: calc(100vw - 120px); background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px; display: flex; flex-wrap: wrap; gap: 2px 10px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35); }
.hint b { font-weight: 600; }
.hint .sep { color: var(--faint); }
.hint .shield { width: 100%; color: var(--muted); font-size: 11px; display: flex; align-items: center; gap: 6px; }

/* ── Panel ────────────────────────────────────── */
.panel { position: fixed; width: 300px; max-height: calc(100vh - 24px); background: var(--bg); border: 1px solid var(--line); border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45); }
.p-head { display: flex; align-items: center; gap: 4px; padding: 6px 6px 6px 6px; border-bottom: 1px solid var(--line); cursor: grab; user-select: none; touch-action: none; }
.p-head.dragging { cursor: grabbing; }
.p-head .grip { color: var(--faint); }
.tabs { display: flex; gap: 2px; }
.tab { height: 28px; padding: 0 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; color: var(--muted); font-weight: 500; }
.tab:hover { color: var(--text); }
.tab.on { background: var(--bg-2); color: var(--text); }
.tools { margin-left: auto; display: flex; gap: 2px; }
.ib { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 6px; color: var(--muted); }
.ib:hover { background: var(--bg-2); color: var(--text); }
.ib.on { background: var(--blue-soft); color: var(--blue-text); }
.ib.sm { width: 24px; height: 24px; }
.p-body { overflow-y: auto; overscroll-behavior: contain; }

.sec { padding: 8px 10px; border-bottom: 1px solid var(--line); }
.sec:last-child { border-bottom: 0; }
.sec-h { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; min-height: 24px; }
.sec-h .r { margin-left: auto; display: flex; align-items: center; gap: 4px; }
.sec-h.strip { width: 100%; }
.sec-h.strip b { color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.seg { display: flex; background: var(--bg-2); border-radius: 5px; padding: 2px; height: 24px; }
.seg button { padding: 0 8px; display: grid; place-items: center; border-radius: 4px; color: var(--muted); font-size: 11px; }
.seg button.on { background: var(--bg-3); color: var(--text); }

/* Layers */
.layers { max-height: 240px; overflow-y: auto; overscroll-behavior: contain; margin: 4px -4px 0; }
.ly { display: flex; align-items: center; gap: 5px; height: 24px; padding-right: 6px; border-radius: 4px; white-space: nowrap; cursor: default; }
.ly:hover { background: var(--bg-2); }
.ly .ch { width: 16px; height: 24px; display: grid; place-items: center; color: var(--faint); flex: none; }
.ly .ch:hover { color: var(--text); }
.ly .k { color: var(--component); }
.ly.tag { color: var(--muted); }
.ly.tag .k { color: var(--faint); }
.ly .nm { overflow: hidden; text-overflow: ellipsis; }
.ly .rep { font: 10px var(--mono); color: var(--muted); background: var(--bg-2); border-radius: 3px; padding: 0 4px; }
.ly .meta { margin-left: auto; padding-left: 8px; color: var(--muted); font: 10px var(--mono); overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
.ly.sel { background: var(--blue); color: #fff; }
.ly.sel .k, .ly.sel .ch, .ly.sel .meta { color: rgba(255, 255, 255, 0.85); }
.ly.sel .rep { background: rgba(255, 255, 255, 0.2); color: #fff; }
.empty-tree { color: var(--muted); padding: 8px 4px; }

/* Inspector */
.crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; color: var(--muted); font-size: 11px; margin-bottom: 4px; }
.crumbs button:hover { color: var(--text); text-decoration: underline; }
.crumbs b { color: var(--text); font-weight: 500; }
.sel-h { display: flex; align-items: center; gap: 8px; }
.sel-h .name { font-size: 15px; font-weight: 500; }
.kind { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(182, 156, 255, 0.16); color: #cdb9ff; }
.kind.tag { background: var(--bg-2); color: var(--muted); }
.facts { margin-top: 4px; font: 11px var(--mono); color: var(--muted); display: flex; flex-wrap: wrap; gap: 2px 12px; }
.row { display: grid; grid-template-columns: 86px 1fr; align-items: center; gap: 8px; min-height: 26px; }
.row .l { color: var(--muted); overflow: hidden; text-overflow: ellipsis; }
.row .v { font: 11px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note { color: var(--muted); font-size: 11px; margin-top: 2px; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.chip { font: 11px var(--mono); background: var(--bg-2); border-radius: 5px; padding: 2px 6px; }
.blank { text-align: center; color: var(--muted); padding: 28px 16px; line-height: 1.6; }
.blank .icon { margin: 0 auto 6px; color: var(--faint); }
`

export const css2 = `
/* ── Changes count ────────────────────────────── */
.fab { overflow: visible; }
.fab .main { border-radius: 22px 0 0 22px; }
.fab .more { border-radius: 0 22px 22px 0; }
.badge { position: absolute; top: -6px; left: 28px; min-width: 18px; height: 18px; border-radius: 9px; background: var(--changed); color: #0b2a17; font: 700 11px/18px 'DM Sans', system-ui, sans-serif; text-align: center; padding: 0 5px; pointer-events: none; }
.tab .ct { font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px; background: var(--changed); color: #0b2a17; display: inline-grid; place-items: center; padding: 0 4px; font-weight: 700; }

/* ── Value fields ─────────────────────────────── */
.row .l.ov { color: var(--text); font-weight: 700; }
.row .l.ov::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--changed); margin-right: 5px; vertical-align: 1px; }
.ctl { display: flex; align-items: center; gap: 4px; min-width: 0; }
.field { flex: 1; min-width: 0; height: 26px; display: flex; align-items: center; gap: 6px; padding: 0 7px; background: var(--bg-2); border: 1px solid transparent; border-radius: 5px; overflow: hidden; white-space: nowrap; }
.field:hover { border-color: var(--bg-3); }
.field.focus { border-color: var(--blue); }
.sw { width: 12px; height: 12px; border-radius: 3px; flex: none; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18); }
.val { font: 11px var(--mono); overflow: hidden; text-overflow: ellipsis; }
.val.token::before, .ol.token::before { content: ''; display: inline-block; width: 6px; height: 6px; border: 1.5px solid currentColor; margin-right: 6px; transform: rotate(45deg); vertical-align: 1px; }
.val.raw { color: #f2c072; }
.val.none { color: var(--muted); }
.inh { font-size: 10px; color: var(--muted); margin-left: auto; }
.rawflag { font-size: 10px; padding: 0 5px; border-radius: 3px; background: rgba(240, 180, 80, 0.16); color: #f2c072; margin-left: auto; flex: none; }
.inh + .rawflag { margin-left: 0; }
.input { all: unset; box-sizing: border-box; flex: 1; min-width: 0; height: 26px; padding: 0 7px; background: var(--bg-2); border: 1px solid transparent; border-radius: 5px; font: 12px 'DM Sans', system-ui, sans-serif; color: var(--text); }
.input:focus { border-color: var(--blue); }
.scope { margin: 0 0 4px 94px; }
.scope .chip { display: inline-flex; align-items: center; height: 22px; padding: 0 8px; border-radius: 11px; background: var(--bg-2); border: 1px solid var(--line); font: 11px 'DM Sans', system-ui, sans-serif; color: var(--text); }

/* ── Style groups ─────────────────────────────── */
.styles { padding-bottom: 0; }
.switch-label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 11px; }
.tg { width: 30px; height: 17px; border-radius: 9px; background: var(--bg-3); position: relative; flex: none; display: inline-block; }
.tg::after { content: ''; position: absolute; top: 3px; left: 3px; width: 11px; height: 11px; border-radius: 50%; background: #a3a1ab; }
.tg.on { background: var(--blue); }
.tg.on::after { left: 16px; background: #fff; }
.grp { border-top: 1px solid var(--line); margin: 6px -10px 0; padding: 0 10px; }
.grp + .grp { margin-top: 0; }
.grp-h { display: flex; width: 100%; align-items: center; gap: 6px; height: 30px; color: var(--text); }
.grp-h .icon { color: var(--muted); }
.grp-h .sum { margin-left: auto; color: var(--muted); font: 10px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
.grp-h .cnt, .sec-h .cnt { margin-left: auto; color: var(--changed); font-size: 11px; }
.grp-body { padding-bottom: 8px; }

/* ── Picker ───────────────────────────────────── */
.backdrop { position: fixed; inset: 0; }
.pop { position: fixed; display: flex; flex-direction: column; background: #222227; border: 1px solid #3c3c46; border-radius: 10px; overflow: hidden; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); }
.search { margin: 8px 8px 4px; height: 28px; display: flex; align-items: center; gap: 6px; padding: 0 8px; background: var(--bg); border-radius: 6px; color: var(--muted); flex: none; }
.search input { all: unset; flex: 1; color: var(--text); font: 12px 'DM Sans', system-ui, sans-serif; }
.pop-list { overflow-y: auto; overscroll-behavior: contain; padding-bottom: 4px; }
.gh { padding: 8px 10px 2px; color: var(--muted); font-size: 10px; }
.op { display: flex; width: 100%; align-items: center; gap: 8px; padding: 0 10px; height: 28px; }
.op:hover { background: var(--bg-2); }
.op.cur { background: var(--blue-soft); }
.op .ol { font: 11px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op .v { margin-left: auto; color: var(--muted); font: 10px var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
.op .tick { color: var(--blue-text); }
.rawin { border-top: 1px solid #3c3c46; padding: 8px 10px; display: flex; align-items: center; gap: 8px; flex: none; }
.rawin .input { background: var(--bg); font-family: var(--mono); font-size: 11px; }
.raw-l, .hint-key { color: var(--muted); font-size: 11px; }

/* ── Changes tab ──────────────────────────────── */
.chg { border: 1px solid var(--line); border-radius: 8px; margin-bottom: 8px; }
.chg-h { display: flex; align-items: center; gap: 6px; padding: 6px 8px; border-bottom: 1px solid var(--line); font: 11px var(--mono); color: var(--muted); }
.chg-h .k { color: var(--component); }
.chg-i { display: flex; align-items: center; gap: 8px; padding: 6px 4px 6px 8px; }
.chg-i + .chg-i { border-top: 1px solid var(--line); }
.chg-i.off .chg-t { opacity: 0.5; }
.chg-t { flex: 1; min-width: 0; }
.chg-t .w { font-weight: 500; }
.chg-t .d { font: 11px var(--mono); color: var(--muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chg-t .d s { color: var(--faint); }
.scope-t { font-size: 10px; padding: 0 5px; border-radius: 3px; background: var(--bg-2); color: var(--muted); margin-left: 6px; }
.act { display: flex; gap: 2px; flex: none; }
.act .gap { width: 8px; }
.banner { background: var(--bg-2); border-radius: 6px; padding: 6px 8px; margin: 0 0 8px; }
.p-foot { border-top: 1px solid var(--line); padding: 8px 10px; display: flex; gap: 6px; align-items: center; flex: none; }
.p-foot .spacer { flex: 1; }
.pbtn { height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border-radius: 6px; font-weight: 500; background: var(--bg-2); }
.pbtn:hover { background: var(--bg-3); }
.pbtn.danger { background: transparent; color: #ff7b72; padding: 0 6px; }
.pbtn.danger:hover { background: rgba(255, 123, 114, 0.1); }

/* ── Toast ────────────────────────────────────── */
.toast { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); background: var(--text); color: #111; font-weight: 500; padding: 0 6px 0 12px; height: 34px; border-radius: 8px; display: flex; gap: 8px; align-items: center; white-space: nowrap; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); }
.toast-act { color: #1a5fd6; font-weight: 700; padding: 0 8px; height: 26px; display: grid; place-items: center; border-radius: 5px; background: rgba(26, 95, 214, 0.1); }

/* ── Phase 3: source, properties, scope ───────── */
.src { margin-top: 2px; font: 11px var(--mono); color: var(--muted); display: flex; align-items: center; gap: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.src .icon { color: var(--faint); }
.sub-h { color: var(--muted); font-size: 11px; margin: 8px 0 2px; }
.seg.wide { flex: 1; min-width: 0; height: 26px; }
.seg.wide button { flex: 1; padding: 0 4px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toggle { display: inline-flex; align-items: center; height: 26px; }
.input.mono { font-family: var(--mono); font-size: 11px; }
.select { appearance: auto; cursor: pointer; }
button.chip { cursor: pointer; gap: 4px; }
button.chip:hover { border-color: var(--bg-3); }
.scope .chip.wide { border-color: rgba(76, 141, 255, 0.5); }
.scope .chip .icon { color: var(--muted); }
.scope-menu { padding: 4px; }
.scope-op { display: flex; flex-direction: column; align-items: flex-start; width: 100%; padding: 7px 8px; border-radius: 6px; gap: 2px; }
.scope-op:hover { background: var(--bg-2); }
.scope-op.cur { background: var(--blue-soft); }
.scope-l { display: flex; align-items: center; gap: 6px; width: 100%; }
.scope-l .tick { margin-left: auto; color: var(--blue-text); }
.scope-d { color: var(--muted); font-size: 11px; }
.box.preview { border: 1.5px dashed rgba(76, 141, 255, 0.85); background: rgba(76, 141, 255, 0.06); }
.scope-t { max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: -3px; }

/* ── Phase 4: prompt ──────────────────────────── */
.prompt { margin: 4px 0 2px; max-height: 260px; overflow: auto; background: #0d0d10; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font: 11px/1.55 var(--mono); color: #cfcdd6; white-space: pre-wrap; word-break: break-word; user-select: text; }
.pbtn.blue { background: var(--blue); color: #fff; margin-left: auto; }
.pbtn.blue:hover { background: #3b7cf0; }

.row.force { margin-top: 6px; }
`
