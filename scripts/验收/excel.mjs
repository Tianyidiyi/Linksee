import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../apps/api/package.json", import.meta.url));
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../../docs/验收/data/excel");

const STUDENT_COUNT = 200;
const TEACHER_COUNT = 20;
const COURSE_COUNT = 20;

const majorPlans = [
  ["软件工程", "软工"],
  ["数据科学", "数科"],
  ["人工智能", "智能"],
  ["网络空间安全", "网安"],
  ["计算机科学与技术", "计科"],
];

const familyNames = ["陈", "林", "赵", "沈", "周", "吴", "何", "许", "郑", "唐", "梁", "顾", "陆", "叶", "宋", "韩", "冯", "袁", "邹", "秦"];
const givenNames = ["一航", "若溪", "明远", "知夏", "景行", "念安", "清越", "星河", "以宁", "亦辰", "思远", "南栀", "嘉树", "舒然", "予白", "承泽", "书瑶", "云起", "向晚", "闻笙"];
const teacherNames = ["陆嘉明", "叶舒然", "汪清源", "程以安", "郭星澜", "方知远", "姜若谷", "夏明礼", "罗修齐", "白景和", "曹听澜", "魏嘉树", "贺长风", "潘明岚", "薛以恒", "邵文清", "任柏舟", "董初晴", "傅景深", "尹知微"];
const assistantNames = ["宋助教", "韩助教", "冯助教", "袁助教", "邹助教", "秦助教", "苏助教", "孟助教", "田助教", "杜助教"];
const courseNames = [
  "软件工程实践",
  "数据系统设计",
  "AI 产品原型",
  "Web 全栈开发",
  "移动应用开发",
  "云原生应用实践",
  "机器学习工程",
  "数据可视化",
  "网络安全攻防",
  "编译原理实践",
  "操作系统课程设计",
  "数据库课程设计",
  "人机交互设计",
  "软件测试与质量",
  "大数据平台实践",
  "自然语言处理",
  "计算机视觉应用",
  "分布式系统实践",
  "信息系统分析",
  "创新创业项目实践",
];

const students = Array.from({ length: STUDENT_COUNT }, (_, index) => {
  const n = index + 1;
  const [major, classPrefix] = majorPlans[index % majorPlans.length];
  const classNo = String((Math.floor(index / majorPlans.length) % 4) + 1).padStart(2, "0");
  const accountNo = `2099001${String(n).padStart(3, "0")}`;
  return [
    accountNo,
    `${familyNames[index % familyNames.length]}${givenNames[Math.floor(index / familyNames.length) % givenNames.length]}${String(n).padStart(3, "0")}`,
    2023,
    major,
    `${classPrefix}23${classNo}`,
    2027,
  ];
});

const teachers = Array.from({ length: TEACHER_COUNT }, (_, index) => {
  const n = index + 1;
  return [
    `20990001${String(n).padStart(2, "0")}`,
    teacherNames[index],
    "计算机学院",
    index % 4 === 0 ? "教授" : index % 4 === 1 ? "副教授" : index % 4 === 2 ? "讲师" : "实验师",
    `T-ACC-${String(n).padStart(4, "0")}`,
    courseNames[index],
  ];
});

let assistantSerial = 1;
const assistants = teachers.flatMap(([teacherId, teacherName], teacherIndex) => {
  const count = teacherIndex % 2 === 0 ? 1 : 2;
  return Array.from({ length: count }, (_, localIndex) => {
    const id = `20990002${String(assistantSerial++).padStart(2, "0")}`;
    return [id, `${assistantNames[(assistantSerial + localIndex) % assistantNames.length]}${String(assistantSerial - 1).padStart(2, "0")}`, teacherId, teacherName];
  });
});

const courses = Array.from({ length: COURSE_COUNT }, (_, index) => {
  const n = index + 1;
  const teacher = teachers[index % teachers.length];
  const projectCount = index % 5 === 0 ? 2 : 1;
  return [`ACC-2026-${String(n).padStart(2, "0")}`, courseNames[index], teacher[0], teacher[1], projectCount];
});

const rosters = Object.fromEntries(courses.map(([courseNo], index) => {
  const size = index < 5 ? 35 : index < 12 ? 28 : 20;
  const start = (index * 9) % students.length;
  const rows = Array.from({ length: size }, (_, offset) => students[(start + offset) % students.length]);
  return [courseNo, rows];
}));

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

writeTable("学生账号导入", ["一卡通号", "姓名", "年级", "专业", "行政班", "届次"], students);
writeTable("教师账号导入", ["一卡通号", "姓名", "学院", "职称", "工号", "研究方向"], teachers);
writeTable("助教账号参考", ["一卡通号", "姓名", "归属教师一卡通号", "归属教师姓名"], assistants);
writeTable("课程参考清单", ["课程号", "课程名", "教师一卡通号", "教师姓名", "项目数"], courses);

for (const [courseNo, rows] of Object.entries(rosters)) {
  writeTable(
    `课程名单-${courseNo}`,
    ["姓名", "一卡通号"],
    rows.map(([accountNo, realName]) => [realName, accountNo]),
  );
}

console.log(`Generated ${students.length} students, ${teachers.length} teachers, ${assistants.length} assistants.`);
console.log(`Generated ${courses.length} course roster pairs in ${outDir}`);
