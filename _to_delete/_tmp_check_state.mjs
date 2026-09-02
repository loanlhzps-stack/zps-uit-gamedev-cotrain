import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i), l.slice(i+1)];}));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const groupId = '0c2416bd-0527-50d3-86d9-ee94ed42c5e8';
const programId = '2b0a0131-d1c1-5599-a0b6-e728d35dc523';

const [members, mentors, sessions, assignments, mentorTasks, groupProject] = await Promise.all([
  supabase.from('group_members').select('profile_id, profiles(display_name)').eq('group_id', groupId),
  supabase.from('mentor_assignments').select('profile_id, mentor_type, profiles(display_name)').eq('group_id', groupId),
  supabase.from('sessions').select('id, session_date, status').eq('program_id', programId).order('session_date'),
  supabase.from('assignments').select('id, title, status, submission_mode').eq('program_id', programId),
  supabase.from('mentor_tasks').select('id, title, status').eq('group_id', groupId),
  supabase.from('group_projects').select('*').eq('group_id', groupId),
]);

console.log('MEMBERS', JSON.stringify(members.data, null, 2), members.error);
console.log('MENTORS', JSON.stringify(mentors.data, null, 2), mentors.error);
console.log('SESSIONS count', sessions.data?.length, JSON.stringify(sessions.data), sessions.error);
console.log('ASSIGNMENTS count', assignments.data?.length, assignments.error);
console.log('MENTOR TASKS', JSON.stringify(mentorTasks.data), mentorTasks.error);
console.log('GROUP PROJECT', JSON.stringify(groupProject.data), groupProject.error);
