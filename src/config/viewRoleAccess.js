// Центральная настройка доступа по ролям.
// Если нужно быстро открыть/закрыть фичу для роли, правь массивы ниже.

const FEATURE_ROLES = {
  tnEdit: ["standart", "preview"],
  tnSendBlock: ["standart", "preview"],
  tnTestButtons: ["preview"],
  plannedModule: ["supergeneral", "standart", "preview"],
  auditLogging: ["preview"],
  journal: ["standart", "preview"],
  pesManage: ["standart", "preview"],
};

export function hasFeatureAccess(viewRole, featureKey) {
  const allowedRoles = FEATURE_ROLES[featureKey] || [];
  return allowedRoles.includes(viewRole);
}

export { FEATURE_ROLES };
