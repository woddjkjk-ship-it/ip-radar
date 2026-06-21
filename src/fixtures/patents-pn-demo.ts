/**
 * 专利号检索演示数据 — 3 件专利
 *
 * Mock 模式下 GET /api/search?mode=pn 统一返回此数据。
 */

import type { PatentSummary } from "@/lib/types";

export const DEMO_PN_PATENTS: PatentSummary[] = [
  {
    patentId: "US20240123456A1",
    pn: "US20240123456A1",
    apno: "US18/123456",
    title: "Multi-modal sensor fusion for autonomous driving perception",
    originalAssignee: "Waymo LLC",
    currentAssignee: "Waymo LLC",
    inventor: "John Smith|Jane Doe",
    apdt: 20230612,
    pbdt: 20240418,
    authority: "US",
  },
  {
    patentId: "CN116994312A",
    pn: "CN116994312A",
    apno: "CN202211234567.X",
    title: "一种基于时空注意力的BEV感知方法及装置",
    originalAssignee: "华为技术有限公司",
    currentAssignee: "华为技术有限公司",
    inventor: "王明|李华",
    apdt: 20221115,
    pbdt: 20230808,
    authority: "CN",
  },
  {
    patentId: "EP4189620B1",
    pn: "EP4189620B1",
    apno: "EP21234567",
    title: "Camera-radar fusion system for object detection in autonomous vehicles",
    originalAssignee: "Mobileye Vision Technologies Ltd.",
    currentAssignee: "Mobileye Vision Technologies Ltd.",
    inventor: "David Cohen|Sarah Johnson",
    apdt: 20210315,
    pbdt: 20230214,
    authority: "EP",
  },
];
