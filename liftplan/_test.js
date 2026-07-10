const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
const m = html.match(/const EMBEDDED_DATA = (\{[\s\S]*?\});  \/\*__EMBED__\*\//);
const EMB = JSON.parse(m[1]);

function parseCSV(text) {
  const rows = []; let row = [], field = "", i = 0, inQ = false;
  text = text.replace(/^\uFEFF/, "");
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i+1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ',') { row.push(field); field = ""; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.trim());
  return rows.filter(r => r.length && !(r.length === 1 && r[0] === ""))
             .map(r => Object.fromEntries(header.map((h, k) => [h, (r[k] ?? "").trim()])));
}

const DB = {};
for (const t of Object.keys(EMB)) DB[t] = parseCSV(Buffer.from(EMB[t], "base64").toString("utf8"));

const exById = Object.fromEntries(DB.exercises.map(e => [e.Exercise_ID, e]));
const muById = Object.fromEntries(DB.muscles.map(x => [x.Muscle_ID, x]));
const grpById = Object.fromEntries(DB.muscle_groups.map(x => [x.Group_ID, x]));
const areaById = Object.fromEntries(DB.general_areas.map(x => [x.Area_ID, x]));
const em = DB.exercise_muscle;

console.log("tables:", Object.keys(DB).map(t => `${t}=${DB[t].length}`).join(", "));
console.log("analyzed exercises:", new Set(em.map(r => r.Exercise_ID)).size);

const badExFK = em.filter(r => !exById[r.Exercise_ID]).length;
const badMuFK = em.filter(r => !muById[r.Muscle_ID]).length;
const badGrp = DB.muscles.filter(x => !grpById[x.Group_ID]).length;
const badArea = DB.muscles.filter(x => !areaById[x.Area_ID]).length;
const badInt = em.filter(r => { const n = Number(r.Intensity_Value); return !Number.isInteger(n) || n < 1 || n > 10; }).length;
const seen = new Set(); let dups = 0;
em.forEach(r => { const k = r.Exercise_ID + "|" + r.Muscle_ID; if (seen.has(k)) dups++; seen.add(k); });

console.log(`FK breaks -> ex:${badExFK} mu:${badMuFK} grp:${badGrp} area:${badArea}`);
console.log(`bad intensity:${badInt}  dup pairs:${dups}`);
console.log("roles:", [...new Set(em.map(r => r.Muscle_Role))].join("/"));
console.log("contraction:", [...new Set(em.map(r => r.Contraction_Type))].join("/"));
console.log("source:", [...new Set(em.map(r => r.Intensity_Source))].join("/"));

for (const id of ["EX0001", "EX0013", "EX0017", "EX0023"]) {
  const rows = em.filter(r => r.Exercise_ID === id && r.Muscle_Role === "Primary")
                 .sort((a, b) => Number(b.Intensity_Value) - Number(a.Intensity_Value));
  const mm = rows.length ? muById[rows[0].Muscle_ID] : null;
  console.log(`${id}  ${exById[id].Exercise_Name}  -> main mover: ${mm ? mm.Specific_Muscle : "none"}`);
}
// Abdominals group spanning two areas
const abGroupMuscles = DB.muscles.filter(x => x.Group_ID === "MG0009");
console.log("MG0009 (Abdominals) areas:", [...new Set(abGroupMuscles.map(x => areaById[x.Area_ID].Area_Name))].join(" + "));
