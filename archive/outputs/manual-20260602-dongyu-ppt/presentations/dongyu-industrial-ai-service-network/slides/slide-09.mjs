import { bg, C, footer, kicker, note, rect, text, titleBox } from "./common.mjs";

export async function slide09(presentation, ctx) {
  const slide = presentation.slides.add();
  bg(slide, ctx);
  kicker(slide, ctx, "WISDOM MODEL", "09", C.copper);
  titleBox(slide, ctx, "白箱方法论不是解释黑箱，\n而是把黑箱输出约束成可审计操作。", 76, 88, 930, 106, 38);
  note(slide, ctx, "智慧模型用订单目录、工艺规则、参数范围、权限边界、异常分支和人工确认，决定 AI 输出能否进入 ODS 交付任务。", 214, 900);

  const x = 90;
  const y = 290;
  const widths = [310, 360, 220];
  const headers = ["黑箱输出状态", "白箱模型化处理", "生产结果"];
  let cx = x;
  headers.forEach((h, i) => {
    rect(slide, ctx, cx, y, widths[i], 42, C.steel, "none", 0, "decision-header");
    text(slide, ctx, h, cx + 18, y + 12, widths[i] - 28, 18, { size: 15, color: C.white, bold: true });
    cx += widths[i];
  });

  const rows = [
    ["匹配订单目录、参数合法、权限满足", "进入现场智脑裁决", "可执行", C.teal],
    ["订单项存在但参数不完整", "补充询问或人工确认", "待确认", C.copper],
    ["参数超出工艺边界", "拦截并返回原因", "不执行", C.red],
    ["订单目录中不存在", "转为需求记录或新订单项开发线索", "不直接执行", C.red],
    ["涉及安全、质量、责任风险", "强制人工确认或升级审批", "受控执行", C.copper],
  ];
  rows.forEach((row, r) => {
    cx = x;
    const top = y + 42 + r * 58;
    row.slice(0, 3).forEach((cell, i) => {
      const fill = i === 2 ? "#F7F8F6" : C.white;
      rect(slide, ctx, cx, top, widths[i], 58, fill, r === 0 ? C.teal : C.line, 1, "decision-cell");
      text(slide, ctx, cell, cx + 18, top + 15, widths[i] - 30, 28, {
        size: i === 2 ? 16 : 14.5,
        color: i === 2 ? row[3] : C.ink,
        bold: i === 2,
        align: i === 2 ? "center" : "left",
      });
      cx += widths[i];
    });
  });

  rect(slide, ctx, 1022, 370, 124, 190, "#F5EEE6", C.copper, 1, "control-note");
  text(slide, ctx, "生产动作", 1044, 408, 74, 22, { size: 18, color: C.copper, bold: true, align: "center" });
  text(slide, ctx, "只有通过\n智慧模型和\n现场智脑后\n才允许执行", 1040, 444, 86, 88, { size: 13.5, color: C.ink, align: "center" });

  footer(slide, ctx, 9);
  return slide;
}
