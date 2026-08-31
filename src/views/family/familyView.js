import { h, mount } from '../../utils/dom.js';
import { t } from '../../i18n/index.js';
import { formatDateTime } from '../../utils/format.js';
import { loadChildContext } from '../../utils/childContext.js';
import {
  subscribeFamilyMembers,
  listPendingInvites,
  inviteFamilyMember,
  removeFamilyMember,
} from '../../services/familyService.js';
import {
  listAccessGrants,
  createAccessGrant,
  revokeAccessGrant,
  isGrantActive,
} from '../../services/accessGrantsService.js';
import { listFamilyConsents, grantFamilyConsent } from '../../services/consentService.js';
import { listFamilyAuditEvents } from '../../services/auditService.js';
import { getCurrentUser } from '../../services/authService.js';
import { openConfirmDialog } from '../../components/confirmDialog.js';
import { createErrorState } from '../../components/states/errorState.js';

const CAPABILITY_OPTIONS = ['view', 'register', 'comment', 'validate'];
const CATEGORY_OPTIONS = [
  'emotions', 'behaviors', 'sleep', 'food', 'medication',
  'school', 'communication', 'sensory', 'achievements', 'observations', 'documents',
];

export async function renderFamilyView() {
  const { familyId, children } = await loadChildContext();
  const container = h('div', { class: 'container view' });
  const uid = getCurrentUser().uid;

  let selectedChildId = children[0]?.id || null;

  async function render() {
    const [members, invites, consents, auditEvents] = await Promise.all([
      new Promise((resolve) => {
        const unsubscribe = subscribeFamilyMembers(familyId, (list) => {
          unsubscribe();
          resolve(list);
        });
      }),
      listPendingInvites(familyId),
      listFamilyConsents(familyId),
      listFamilyAuditEvents(familyId).catch(() => []),
    ]);

    const grants = selectedChildId ? await listAccessGrants(selectedChildId) : [];
    const isOwner = members.find((m) => m.id === uid)?.role === 'owner';

    mount(container, [
      h('header', { class: 'view__header' }, [h('h1', {}, [t('family.title')]), h('p', { class: 'view__lead' }, [t('family.subtitle')])]),

      renderMembersSection(members, invites, isOwner),
      renderAccessGrantsSection(grants, isOwner),
      renderConsentsSection(consents, isOwner),
      renderAuditSection(auditEvents),
    ]);
  }

  function renderMembersSection(members, invites, isOwner) {
    const emailInput = h('input', { class: 'input', type: 'email', id: 'invite-email', required: true });
    const feedback = h('div', {});

    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('family.sectionMembers')]),
      h(
        'ul',
        { style: 'list-style:none; padding:0; display:flex; flex-direction:column; gap:var(--space-2)' },
        members.map((member) =>
          h('li', { style: 'display:flex; justify-content:space-between; gap:var(--space-3); align-items:center' }, [
            h('span', {}, [member.id === uid ? `${member.id} (${t('common.confirm')})` : member.id]),
            h('span', { class: 'card__meta' }, [t(member.role === 'owner' ? 'family.roleOwner' : 'family.roleCaregiver')]),
            isOwner && member.role !== 'owner'
              ? h('button', {
                  type: 'button',
                  class: 'btn btn--ghost',
                  onClick: () => {
                    openConfirmDialog({
                      title: t('family.removeMemberConfirmTitle'),
                      body: t('family.removeMemberConfirmBody'),
                      confirmLabel: t('common.confirm'),
                      cancelLabel: t('common.cancel'),
                      onConfirm: async () => {
                        await removeFamilyMember(familyId, member.id);
                        render();
                      },
                    });
                  },
                }, [t('family.removeMemberCta')])
              : '',
          ])
        )
      ),

      isOwner
        ? h(
            'form',
            {
              style: 'margin-top: var(--space-4)',
              onSubmit: async (event) => {
                event.preventDefault();
                try {
                  const result = await inviteFamilyMember(familyId, emailInput.value.trim());
                  const link = `${window.location.origin}${window.location.pathname}#/aceitar-convite/${familyId}/${result.inviteId}/${result.token}`;
                  mount(feedback, [
                    h('div', { class: 'notice notice--success' }, [
                      h('p', {}, [t('family.inviteSentBody')]),
                      h('code', { style: 'word-break:break-all' }, [link]),
                    ]),
                  ]);
                } catch (err) {
                  mount(feedback, [createErrorState({ body: err.message })]);
                }
              },
            },
            [
              h('div', { class: 'form-field' }, [h('label', { for: 'invite-email' }, [t('family.inviteEmailLabel')]), emailInput]),
              h('button', { type: 'submit', class: 'btn btn--secondary' }, [t('family.inviteCta')]),
              feedback,
            ]
          )
        : '',

      h('h3', { style: 'font-size:var(--font-size-sm); margin-top: var(--space-4)' }, [t('family.pendingInvitesTitle')]),
      invites.length === 0
        ? h('p', { class: 'card__meta' }, [t('family.noPendingInvites')])
        : h('ul', {}, invites.map((invite) => h('li', {}, [invite.email]))),
    ]);
  }

  function renderAccessGrantsSection(grants, isOwner) {
    const childSelect = h(
      'select',
      { class: 'select', style: 'max-width:220px' },
      children.map((child) => h('option', { value: child.id, selected: child.id === selectedChildId || undefined }, [child.name]))
    );
    childSelect.addEventListener('change', () => {
      selectedChildId = childSelect.value;
      render();
    });

    const granteeEmailInput = h('input', { class: 'input', type: 'email', id: 'grant-email', required: true });
    const roleSelect = h('select', { class: 'select', id: 'grant-role' }, [
      h('option', { value: 'school_collaborator' }, [t('family.roleSchoolCollaborator')]),
      h('option', { value: 'professional_reviewer' }, [t('family.roleProfessionalReviewer')]),
    ]);
    const capabilityChecks = CAPABILITY_OPTIONS.map((capability) =>
      h('label', { class: 'chip-option' }, [
        h('input', { type: 'checkbox', value: capability, checked: capability === 'view' || undefined }),
        t(`family.capability${capability[0].toUpperCase()}${capability.slice(1)}`),
      ])
    );
    const categoryChecks = CATEGORY_OPTIONS.map((category) =>
      h('label', { class: 'chip-option' }, [
        h('input', { type: 'checkbox', value: category }),
        category === 'documents' ? t('family.grantScopeDocuments') : t(`register.categories.${category}.label`),
      ])
    );
    const expiresInput = h('input', { class: 'input', type: 'date', id: 'grant-expires', required: true });
    const feedback = h('div', {});

    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('family.sectionAccessGrants')]),
      h('p', { class: 'view__lead' }, [t('family.sectionAccessGrantsHint')]),
      h('div', { class: 'form-field' }, [h('label', {}, [t('family.selectChildLabel')]), childSelect]),

      h('h3', { style: 'font-size:var(--font-size-sm)' }, [t('family.activeGrantsTitle')]),
      grants.length === 0
        ? h('p', { class: 'card__meta' }, [t('family.noGrants')])
        : h(
            'ul',
            { style: 'list-style:none; padding:0; display:grid; gap:var(--space-2)' },
            grants.map((grant) =>
              h('li', { class: 'card', style: 'padding:var(--space-3)' }, [
                h('div', { style: 'display:flex; justify-content:space-between; gap:var(--space-2)' }, [
                  h('span', {}, [grant.granteeEmail]),
                  h('span', { class: 'category-chip' }, [
                    t(
                      grant.revokedAt
                        ? 'family.grantStatusRevoked'
                        : isGrantActive(grant)
                          ? 'family.grantStatusActive'
                          : grant.granteeUid
                            ? 'family.grantStatusExpired'
                            : 'family.grantStatusPending'
                    ),
                  ]),
                ]),
                h('p', { class: 'card__meta' }, [grant.capabilities.join(', '), ' · ', grant.scopeCategories.join(', ')]),
                isOwner && !grant.revokedAt
                  ? h('button', {
                      type: 'button',
                      class: 'btn btn--ghost',
                      onClick: () => {
                        openConfirmDialog({
                          title: t('family.revokeGrantConfirmTitle'),
                          body: t('family.revokeGrantConfirmBody'),
                          confirmLabel: t('common.confirm'),
                          cancelLabel: t('common.cancel'),
                          onConfirm: async () => {
                            await revokeAccessGrant(selectedChildId, grant.id);
                            render();
                          },
                        });
                      },
                    }, [t('family.revokeGrantCta')])
                  : '',
              ])
            )
          ),

      isOwner
        ? h(
            'form',
            {
              style: 'margin-top: var(--space-4)',
              onSubmit: async (event) => {
                event.preventDefault();
                const capabilities = capabilityChecks
                  .map((label) => label.querySelector('input'))
                  .filter((input) => input.checked)
                  .map((input) => input.value);
                const scopeCategories = categoryChecks
                  .map((label) => label.querySelector('input'))
                  .filter((input) => input.checked)
                  .map((input) => input.value);

                try {
                  await createAccessGrant(selectedChildId, {
                    granteeEmail: granteeEmailInput.value.trim(),
                    role: roleSelect.value,
                    capabilities: capabilities.length ? capabilities : ['view'],
                    scopeCategories: scopeCategories.length ? scopeCategories : ['school'],
                    expiresAtMillis: new Date(expiresInput.value).getTime(),
                  });
                  render();
                } catch (err) {
                  mount(feedback, [createErrorState({ body: err.message })]);
                }
              },
            },
            [
              h('div', { class: 'form-field' }, [h('label', { for: 'grant-email' }, [t('family.granteeEmailLabel')]), granteeEmailInput]),
              h('div', { class: 'form-field' }, [h('label', { for: 'grant-role' }, [t('family.grantRoleLabel')]), roleSelect]),
              h('div', { class: 'form-field' }, [
                h('span', { style: 'font-weight:var(--font-weight-medium)' }, [t('family.grantCapabilitiesLabel')]),
                h('div', { class: 'checkbox-group' }, capabilityChecks),
              ]),
              h('div', { class: 'form-field' }, [
                h('span', { style: 'font-weight:var(--font-weight-medium)' }, [t('family.grantScopeLabel')]),
                h('div', { class: 'checkbox-group' }, categoryChecks),
              ]),
              h('div', { class: 'form-field' }, [h('label', { for: 'grant-expires' }, [t('family.grantExpiresLabel')]), expiresInput]),
              h('button', { type: 'submit', class: 'btn btn--secondary' }, [t('family.createGrantCta')]),
              feedback,
            ]
          )
        : '',
    ]);
  }

  function renderConsentsSection(consents, isOwner) {
    return h('section', { class: 'card', style: 'margin-bottom: var(--space-4)' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('family.sectionConsents')]),
      consents.length === 0
        ? h('p', { class: 'card__meta' }, [t('family.noConsents')])
        : h(
            'ul',
            {},
            consents.map((consent) =>
              h('li', {}, [
                `${consent.type} — ${formatDateTime(consent.grantedAt?.toDate ? consent.grantedAt.toDate() : consent.grantedAt)}`,
                consent.revokedAt ? ` (${t('family.grantStatusRevoked')})` : '',
              ])
            )
          ),
      isOwner
        ? h('button', {
            type: 'button',
            class: 'btn btn--secondary',
            style: 'margin-top: var(--space-3)',
            onClick: async () => {
              await grantFamilyConsent(familyId, { type: t('family.consentTermsType') });
              render();
            },
          }, [t('family.grantTermsConsentCta')])
        : '',
    ]);
  }

  function renderAuditSection(events) {
    return h('section', { class: 'card' }, [
      h('h2', { style: 'font-size:var(--font-size-md)' }, [t('family.sectionAudit')]),
      h('p', { class: 'view__lead' }, [t('family.sectionAuditHint')]),
      events.length === 0
        ? h('p', { class: 'card__meta' }, [t('family.noAuditEvents')])
        : h(
            'ul',
            {},
            events.map((event) =>
              h('li', {}, [
                `${formatDateTime(event.createdAt?.toDate ? event.createdAt.toDate() : event.createdAt)} — ${event.action}`,
              ])
            )
          ),
    ]);
  }

  await render();
  return container;
}
