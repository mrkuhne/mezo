// ============================================================
// Mezo · WorkoutDock — the floating bar of the active workout (mezo-88iwa.7; Folyadék look: mezo-n4wf5.4).
// The look and the portal are the shared `SessionDock` (prototype `dock()`): between sets the done work as a level +
// „Lezárás", during a rest the vessel that drains with the countdown + „+30 mp" / „Tovább". This name stays as the
// session's own dock so the page keeps one import; it owns no timer — the page's `useRestTimer()` drives it by props.
// ============================================================
export { SessionDock as WorkoutDock, type SessionDockProps as WorkoutDockProps } from '@/features/train/components/folyadek'
