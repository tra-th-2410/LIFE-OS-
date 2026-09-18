export type ConversationState =
  | 'opening'
  | 'listening'
  | 'exploring'
  | 'emotional_support'
  | 'problem_solving'
  | 'reflection'
  | 'crisis';

export interface MindCareConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface MindCareMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_safety_triggered?: boolean;
  created_at: string;
}

export interface MindCareMemory {
  id: string;
  user_id: string;
  key_point: string;
  category: 'feeling' | 'relationship' | 'pressure' | 'preference' | 'general';
  confidence: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrisisResource {
  name: string;
  nameVi: string;
  phone: string;
  description: string;
  descriptionVi: string;
  isEmergency?: boolean;
  hours: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  {
    name: 'Ngay Mai Hotline (Depression & Crisis Support)',
    nameVi: 'Đường dây nóng Ngày Mai (Hỗ trợ người khủng hoảng & trầm cảm)',
    phone: '096 306 1414',
    description: 'Free, compassionate listening & crisis support in Vietnam (13:00 - 20:30 daily)',
    descriptionVi: 'Lắng nghe nhân văn, phi phán xét và hỗ trợ tâm lý khủng hoảng miễn phí tại Việt Nam',
    hours: '13:00 - 20:30 hàng ngày',
  },
  {
    name: 'National Child Protection Hotline',
    nameVi: 'Tổng đài Quốc gia Bảo vệ Trẻ em & Học sinh',
    phone: '111',
    description: '24/7 National hotline for youth and students in distress or needing protection',
    descriptionVi: 'Tổng đài miễn phí 24/7 bảo vệ và tư vấn tâm lý cho trẻ em, học sinh, thanh thiếu niên',
    hours: '24/7 Miễn cước',
  },
  {
    name: 'National Emergency Medical Services',
    nameVi: 'Cấp cứu Y tế Khẩn cấp',
    phone: '115',
    description: 'Immediate emergency medical and acute life safety assistance in Vietnam',
    descriptionVi: 'Hỗ trợ y tế và cấp cứu thể chất khẩn cấp trên toàn quốc',
    isEmergency: true,
    hours: '24/7 Toàn quốc',
  },
  {
    name: 'International Suicide & Crisis Lifeline (US & Global)',
    nameVi: 'Đường dây Cứu trợ Khủng hoảng Quốc tế',
    phone: '988',
    description: 'Free, confidential support for people in suicidal crisis or emotional distress (US/Global)',
    descriptionVi: 'Hỗ trợ khủng hoảng và tâm lý khẩn cấp quốc tế',
    hours: '24/7 English/Multilingual',
  },
];
