import { del, get, post, put, query } from './client';
import type {
  AssignmentRequest, AssignmentView, AuditRow, CancelResponse, CategoryAvailability, ChannelRevenue, ClientRequest,
  ClientView, Cabinet, Coded, ConditionView, CreateVoucherRequest, Customer, DirectoryRecord, ForecastPoint, ForecastRunResult,
  HistoryPoint, KpiView, MeView, PayResponse, PriceReview, Procedure, RegisterRequest, Room, RoomCategory,
  SalesChannel, ScheduleEntry, TokenResponse, UserRow, VoucherView, WaitlistEntry, WaitlistRequest,
} from '../types';

export const auth = {
  login: (username: string, password: string) => post<TokenResponse>('/api/auth/login', { username, password }),
  register: (r: RegisterRequest) => post<void>('/api/auth/register', r),
};

export const profile = {
  me: () => get<MeView>('/api/me'),
  update: (r: { fullName: string; email?: string }) => put<MeView>('/api/me', r),
  changePassword: (oldPassword: string, newPassword: string) => put<void>('/api/me/password', { oldPassword, newPassword }),
  conditions: () => get<ConditionView[]>('/api/me/conditions'),
};

export const directory = {
  categories: () => get<RoomCategory[]>('/api/directory/room-categories'),
  profiles: () => get<Coded[]>('/api/directory/treatment-profiles'),
  diets: () => get<Coded[]>('/api/directory/diets'),
  conditions: () => get<Coded[]>('/api/directory/medical-conditions'),
  channels: () => get<SalesChannel[]>('/api/directory/sales-channels'),
  procedures: () => get<Procedure[]>('/api/directory/procedures'),
  rooms: () => get<Room[]>('/api/directory/rooms'),
  cabinets: () => get<Cabinet[]>('/api/directory/cabinets'),
  customers: () => get<Customer[]>('/api/directory/customers'),
  // универсальный CRUD для страницы справочников (запись — только SYSADMIN)
  list: (resource: string) => get<DirectoryRecord[]>(`/api/directory/${resource}`),
  create: (resource: string, body: unknown) => post<DirectoryRecord>(`/api/directory/${resource}`, body),
  update: (resource: string, id: number, body: unknown) => put<DirectoryRecord>(`/api/directory/${resource}/${id}`, body),
  remove: (resource: string, id: number) => del<void>(`/api/directory/${resource}/${id}`),
};

export const booking = {
  availability: (from: string, to: string, places: number) =>
    get<CategoryAvailability[]>(`/api/availability${query({ from, to, places })}`),
  create: (r: CreateVoucherRequest) => post<VoucherView>('/api/vouchers', r),
  all: (status?: string) => get<VoucherView[]>(`/api/vouchers${query({ status })}`),
  my: () => get<VoucherView[]>('/api/vouchers/my'),
  one: (id: number) => get<VoucherView>(`/api/vouchers/${id}`),
  pay: (id: number) => post<PayResponse>(`/api/vouchers/${id}/pay`),
  cancel: (id: number) => post<CancelResponse>(`/api/vouchers/${id}/cancel`),
  checkIn: (id: number) => post<VoucherView>(`/api/vouchers/${id}/check-in`),
  checkOut: (id: number) => post<VoucherView>(`/api/vouchers/${id}/check-out`),
};

export const waitlist = {
  add: (r: WaitlistRequest) => post<WaitlistEntry>('/api/waitlist', r),
  my: () => get<WaitlistEntry[]>('/api/waitlist/my'),
  all: (status?: string) => get<WaitlistEntry[]>(`/api/waitlist${query({ status })}`),
  remove: (id: number) => del<void>(`/api/waitlist/${id}`),
};

export const clients = {
  search: (q: string) => get<ClientView[]>(`/api/clients${query({ q, size: 50 })}`),
  one: (id: number) => get<ClientView>(`/api/clients/${id}`),
  create: (r: ClientRequest) => post<ClientView>('/api/clients', r),
  update: (id: number, r: ClientRequest) => put<ClientView>(`/api/clients/${id}`, r),
  conditions: (id: number) => get<ConditionView[]>(`/api/clients/${id}/conditions`),
  addCondition: (id: number, conditionId: number) =>
    post<void>(`/api/clients/${id}/conditions`, { conditionId }),
  removeCondition: (id: number, conditionId: number) => del<void>(`/api/clients/${id}/conditions/${conditionId}`),
};

export const medical = {
  create: (r: AssignmentRequest) => post<AssignmentView>('/api/assignments', r),
  byVoucher: (voucherId: number) => get<AssignmentView[]>(`/api/assignments/by-voucher/${voucherId}`),
  plan: (assignmentId: number) => post<ScheduleEntry[]>(`/api/assignments/${assignmentId}/schedule`),
  ofAssignment: (assignmentId: number) => get<ScheduleEntry[]>(`/api/assignments/${assignmentId}/schedule`),
  day: (date: string) => get<ScheduleEntry[]>(`/api/schedule${query({ date })}`),
  done: (slotId: number) => post<void>(`/api/schedule/${slotId}/done`),
};

export const reports = {
  kpi: (from: string, to: string) => get<KpiView>(`/api/reports/kpi${query({ from, to })}`),
  channels: () => get<ChannelRevenue[]>('/api/reports/channels'),
};

// pricing-forecast: шлюз срезает префикс /pricing
export const pricing = {
  reviews: (statusFilter?: string) =>
    get<PriceReview[]>(`/pricing/price/reviews${query({ status_filter: statusFilter })}`),
  decide: (id: number, action: 'ACKNOWLEDGE' | 'RULE_ADJUSTED') =>
    post<PriceReview>(`/pricing/price/reviews/${id}/decide`, { action }),
  createCorridor: (r: { category_id: number; date_from: string; date_to: string; p_min: number; p_max: number; min_los: number; closed: boolean }) =>
    post<{ id: number }>('/pricing/pricing-rules/corridors', r),
  seasons: (r: { name: string; date_from: string; date_to: string; k_season: number }) =>
    post<{ id: number }>('/pricing/pricing-rules/seasons', r),
  listSeasons: () =>
    get<{ id: number; name: string; date_from: string; date_to: string; k_season: number }[]>('/pricing/pricing-rules/seasons'),
  listTariffs: (seasonId?: number, categoryId?: number) =>
    get<{ id: number; season_id: number; category_id: number; price_base: number }[]>(
      `/pricing/pricing-rules/tariffs${query({ season_id: seasonId, category_id: categoryId })}`),
  tariffs: (r: { season_id: number; category_id: number; price_base: number }) =>
    post<{ id: number }>('/pricing/pricing-rules/tariffs', r),
  history: (categoryId: number, from: string, to: string) =>
    get<HistoryPoint[]>(`/pricing/history/${categoryId}${query({ date_from: from, date_to: to })}`),
  importHistory: (categoryId: number, points: HistoryPoint[]) =>
    post<{ upserted: number }>(`/pricing/history/${categoryId}`, points),
  runForecast: (categoryId: number) => post<ForecastRunResult>(`/pricing/forecast/${categoryId}/run`),
  forecast: (categoryId: number, from: string, to: string) =>
    get<ForecastPoint[]>(`/pricing/forecast/${categoryId}${query({ date_from: from, date_to: to })}`),
};

export const admin = {
  users: () => get<UserRow[]>('/api/users?size=200'),
  createUser: (r: { username: string; password: string; fullName: string; email?: string; roles: string[] }) =>
    post<{ id: number }>('/api/users', r),
  setRoles: (id: number, roles: string[]) => put<void>(`/api/users/${id}/roles`, { roles }),
  setActive: (id: number, active: boolean) => put<void>(`/api/users/${id}/active`, { active }),
  resetPassword: (id: number, password: string) => put<void>(`/api/users/${id}/password`, { password }),
  audit: (page: number) => get<AuditRow[]>(`/api/audit${query({ page, size: 50 })}`),
};

export { loyaltyApi as loyalty, ehrApi as ehr } from './loyaltyAndEhr';
export { notificationsApi as notifications, refundsApi as refunds } from './notificationsAndRefunds';
export { biApi as bi, packagesApi as packages, inventoryApi as inventory, staffApi as staff } from './biAndOperations';
export { interactiveRoomsApi as interactiveRooms, smartRecommendationsApi as smartRecommendations } from './interactiveMapAndRecommendations';
export { reviewsApi as reviews } from './reviewsAndQuality';



