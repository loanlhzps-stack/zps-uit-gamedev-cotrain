"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Global search (Main Bar) — added after the search box was found to be
 * decorative (no-op) during a later review pass; not in the original
 * design doc, built on request. Every query below runs through the
 * caller's own session-scoped Supabase client (never service-role), so
 * Row Level Security enforces exactly the same visibility here as on
 * every other page — a Mentor searching finds only what they could
 * already reach by clicking around, no separate permission logic
 * needed in this file.
 */

export interface SearchResultItem {
  id: string;
  label: string;
  sublabel?: string;
  href: string;
}

export interface SearchCategory {
  key: string;
  title: string;
  items: SearchResultItem[];
}

const MIN_QUERY_LENGTH = 2;
const PER_CATEGORY_LIMIT = 5;

function formatDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export async function searchAll(programId: string, rawQuery: string): Promise<SearchCategory[]> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH) return [];

  const supabase = await createClient();
  const like = `%${query}%`;

  const [
    membershipRes,
    blocksRes,
    assignmentsRes,
    groupsRes,
    projectsByNameRes,
    projectsByConceptRes,
    profilesRes,
    attendanceRes,
  ] = await Promise.all([
      supabase
        .from("program_memberships")
        .select("role")
        .eq("program_id", programId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle(),
      supabase
        .from("session_blocks")
        .select("id, title, session_id, sessions!inner(session_date, program_id)")
        .eq("sessions.program_id", programId)
        .ilike("title", like)
        .limit(PER_CATEGORY_LIMIT),
      supabase
        .from("assignments")
        .select("id, title")
        .eq("program_id", programId)
        .ilike("title", like)
        .limit(PER_CATEGORY_LIMIT),
      supabase
        .from("groups")
        .select("id, name")
        .eq("program_id", programId)
        .ilike("name", like)
        .limit(PER_CATEGORY_LIMIT),
      supabase
        .from("group_projects")
        .select("id, group_id, game_name, concept, groups!inner(name, program_id)")
        .eq("groups.program_id", programId)
        .ilike("game_name", like)
        .limit(PER_CATEGORY_LIMIT),
      supabase
        .from("group_projects")
        .select("id, group_id, game_name, concept, groups!inner(name, program_id)")
        .eq("groups.program_id", programId)
        .ilike("concept", like)
        .limit(PER_CATEGORY_LIMIT),
      supabase.from("profiles").select("id, display_name").ilike("display_name", like).limit(PER_CATEGORY_LIMIT),
      supabase
        .from("attendance_sheets")
        .select("id, session_id, group_id, groups!inner(name, program_id), sessions!inner(session_date)")
        .eq("groups.program_id", programId)
        .ilike("groups.name", like)
        .limit(PER_CATEGORY_LIMIT),
    ]);

  const role = membershipRes.data?.role;
  // Quản lý thành viên giờ chỉ Owner (theo yêu cầu của bạn — bỏ khỏi
  // Co-owner, xem lib/nav.ts) nên quick search cũng chỉ dẫn Owner tới đây.
  const canOpenPeople = role === "owner";

  const sessionItems: SearchResultItem[] = (blocksRes.data ?? []).map((b) => {
    const session = Array.isArray(b.sessions) ? b.sessions[0] : b.sessions;
    return {
      id: b.id,
      label: b.title,
      sublabel: session ? `Buổi ${formatDate(session.session_date)}` : "Buổi học",
      href: `/app/schedule/${b.session_id}`,
    };
  });

  const assignmentItems: SearchResultItem[] = (assignmentsRes.data ?? []).map((a) => ({
    id: a.id,
    label: a.title,
    sublabel: "Bài tập",
    href: `/app/assignments/${a.id}`,
  }));

  const groupItems: SearchResultItem[] = (groupsRes.data ?? []).map((g) => ({
    id: g.id,
    label: g.name,
    sublabel: "Nhóm",
    href: `/app/groups/${g.id}`,
  }));

  const projectRows = [...(projectsByNameRes.data ?? []), ...(projectsByConceptRes.data ?? [])];
  const seenProjectIds = new Set<string>();
  const projectItems: SearchResultItem[] = [];
  for (const p of projectRows) {
    if (seenProjectIds.has(p.id) || projectItems.length >= PER_CATEGORY_LIMIT) continue;
    seenProjectIds.add(p.id);
    const group = Array.isArray(p.groups) ? p.groups[0] : p.groups;
    projectItems.push({
      id: p.id,
      label: p.game_name || p.concept || "(Chưa đặt tên dự án)",
      sublabel: group ? `Dự án · Nhóm ${group.name}` : "Dự án",
      href: `/app/groups/${p.group_id}`,
    });
  }

  const attendanceItems: SearchResultItem[] = (attendanceRes.data ?? []).map((s) => {
    const group = Array.isArray(s.groups) ? s.groups[0] : s.groups;
    const session = Array.isArray(s.sessions) ? s.sessions[0] : s.sessions;
    return {
      id: s.id,
      label: group ? `Nhóm ${group.name}` : "Điểm danh",
      sublabel: session ? `Điểm danh · Buổi ${formatDate(session.session_date)}` : "Điểm danh",
      href: `/app/attendance/${s.session_id}/${s.group_id}`,
    };
  });

  const peopleItems: SearchResultItem[] = canOpenPeople
    ? (profilesRes.data ?? []).map((p) => ({
        id: p.id,
        label: p.display_name,
        sublabel: "Thành viên",
        href: "/app/people",
      }))
    : [];

  const categories: SearchCategory[] = [
    { key: "sessions", title: "Buổi học", items: sessionItems },
    { key: "assignments", title: "Bài tập", items: assignmentItems },
    { key: "groups", title: "Nhóm", items: groupItems },
    { key: "projects", title: "Dự án", items: projectItems },
    { key: "attendance", title: "Điểm danh", items: attendanceItems },
    { key: "people", title: "Thành viên", items: peopleItems },
  ];

  return categories.filter((c) => c.items.length > 0);
}
