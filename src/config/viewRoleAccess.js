// Центральная настройка доступа по ролям.
// Если нужно быстро открыть/закрыть фичу для роли, правь массивы ниже.

const FEATURE_ROLES = {
  tnEdit: ["standart", "preview"],
  tnSendBlock: ["standart", "preview"],
  tnTestButtons: ["preview"],
  journal: ["standart"],
  pesManage: ["standart"],
};

export function hasFeatureAccess(viewRole, featureKey) {
  const allowedRoles = FEATURE_ROLES[featureKey] || [];
  return allowedRoles.includes(viewRole);
}

export { FEATURE_ROLES };
