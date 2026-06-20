import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../../docs/验收/data/excel-addon");

const students = [
  ["2099019001", "验收学生甲", 2023, "软件工程", "软工2309", 2027],
  ["2099019002", "验收学生乙", 2023, "软件工程", "软工2309", 2027],
  ["2099019003", "验收学生丙", 2023, "软件工程", "软工2309", 2027],
  ["2099019004", "验收学生丁", 2023, "数据科学与大数据技术", "数科2308", 2027],
  ["2099019005", "验收学生戊", 2023, "数据科学与大数据技术", "数科2308", 2027],
  ["2099019006", "验收学生己", 2023, "人工智能", "智能2307", 2027],
  ["2099019007", "验收学生庚", 2023, "人工智能", "智能2307", 2027],
  ["2099019008", "验收学生辛", 2023, "网络空间安全", "网安2306", 2027],
  ["2099019009", "验收学生壬", 2023, "计算机科学与技术", "计科2305", 2027],
  ["2099019010", "验收学生癸", 2023, "计算机科学与技术", "计科2305", 2027],
];

const teachers = [
  ["2099010101", "验收教师甲", "计算机学院", "副教授", "T-LIVE-0001", "软件工程课程实践"],
  ["2099010102", "验收教师乙", "计算机学院", "讲师", "T-LIVE-0002", "数据系统课程设计"],
];

const assistantRefs = [
  ["2099010201", "验收助教甲", "2099010101", "验收教师甲"],
  ["2099010202", "验收助教乙", "2099010102", "验收教师乙"],
];

const courseRefs = [
  ["ACC-LIVE-01", "课程协作验收现场演示", "2099010101", "验收教师甲", "建议演示主课程"],
  ["ACC-LIVE-02", "课程协作验收补充场景", "2099010102", "验收教师乙", "建议演示删除/草稿/归档场景"],
];

const rosters = {
  "ACC-LIVE-01": [
    ["验收学生甲", "2099019001"],
    ["验收学生乙", "2099019002"],
    ["验收学生丙", "2099019003"],
    ["验收学生丁", "2099019004"],
    ["验收学生戊", "2099019005"],
    ["验收学生己", "2099019006"],
  ],
  "ACC-LIVE-02": [
    ["验收学生庚", "2099019007"],
    ["验收学生辛", "2099019008"],
    ["验收学生壬", "2099019009"],
    ["验收学生癸", "2099019010"],
  ],
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function toCsv(rows) {
  return "\ufeff" + rows.map((row) => row.map((cell) => {
    const text = String(cell ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }).join(",")).join("\r\n") + "\r\n";
}

function writeTable(baseName, header, rows) {
  const aoa = [header, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  XLSX.writeFile(workbook, path.join(outDir, `${baseName}.xlsx`));
  fs.writeFileSync(path.join(outDir, `${baseName}.csv`), toCsv(aoa), "utf8");
}

ensureDir(outDir);

writeTable("增量导入-学生账号", ["一卡通号", "姓名", "年级", "专业", "行政班", "届次"], students);
writeTable("增量导入-教师账号", ["一卡通号", "姓名", "学院", "职称", "工号", "研究方向"], teachers);
writeTable("增量参考-助教账号", ["一卡通号", "姓名", "归属教师一卡通号", "归属教师姓名"], assistantRefs);
writeTable("增量参考-课程清单", ["课程号", "课程名", "建议主讲教师一卡通号", "建议主讲教师姓名", "用途"], courseRefs);

for (const [courseNo, rows] of Object.entries(rosters)) {
  writeTable(`增量名单-${courseNo}`, ["姓名", "一卡通号"], rows);
}

console.log(`Generated addon excel files in ${outDir}`);
