import { titleCase } from '../../../supabase/functions/delivery-reminders/thankYouEmail';
import { LEGAL_UPDATED, MAHANEX, PROVINCES, type DealershipLegal, type LegalKind, type ProvinceCode } from './legal';

// The wording of the three legal pages. These are careful plain-language
// drafts for a Canadian dealership, not legal advice: have a lawyer review
// them (the Terms especially) before relying on them.

export type Block = string | { list: string[] };
export interface LegalSection { id: string; heading: string; blocks: Block[] }
export interface LegalDoc { title: string; summary: string; sections: LegalSection[] }

interface Ctx {
  org: string; // the party responsible: "401 Dixie Nissan" or "your dealership"
  orgShort: string;
  hasDealership: boolean;
  dealership: DealershipLegal | null;
  provinceName: string;
  privacyLaw: string;
  commissioner: string;
  howToReach: string;
}

const PRIVACY_LAW: Record<string, { law: string; commissioner: string }> = {
  BC: { law: "British Columbia's Personal Information Protection Act", commissioner: 'the Office of the Information and Privacy Commissioner for British Columbia' },
  AB: { law: "Alberta's Personal Information Protection Act", commissioner: 'the Office of the Information and Privacy Commissioner of Alberta' },
  QC: { law: "Québec's Act respecting the protection of personal information in the private sector", commissioner: "the Commission d'accès à l'information du Québec" },
};
const FEDERAL = { law: "Canada's Personal Information Protection and Electronic Documents Act (PIPEDA)", commissioner: 'the Office of the Privacy Commissioner of Canada' };

export function formatAddress(d: DealershipLegal | null): string | null {
  if (!d) return null;
  const parts = [d.address, d.city].filter(Boolean).map((s) => titleCase(s as string));
  return parts.length ? parts.join(', ') : null;
}

function context(d: DealershipLegal | null): Ctx {
  const province = (d?.province ?? 'ON') as ProvinceCode;
  const law = PRIVACY_LAW[province] ?? FEDERAL;
  const org = d ? titleCase(d.legalName) : 'your dealership';
  const how = d?.privacyEmail
    ? `email ${d.privacyEmail}`
    : d?.phone
      ? `call ${d.phone} and ask for the privacy contact`
      : "ask your dealership's management for its privacy contact";
  return {
    org,
    orgShort: d ? titleCase(d.name) : 'your dealership',
    hasDealership: !!d,
    dealership: d,
    provinceName: PROVINCES.find((p) => p.code === province)?.name ?? 'Ontario',
    privacyLaw: law.law,
    commissioner: law.commissioner,
    howToReach: how,
  };
}

export function legalDoc(kind: LegalKind, d: DealershipLegal | null): LegalDoc {
  const c = context(d);
  return kind === 'privacy' ? privacy(c) : kind === 'terms' ? terms(c) : cookies(c);
}

export function legalTitle(kind: LegalKind, d: DealershipLegal | null): string {
  return `${d ? titleCase(d.name) + ' — ' : ''}${kind === 'privacy' ? 'Privacy notice' : kind === 'terms' ? 'Terms of use' : 'Cookies & storage'}`;
}

const providerLine = (c: Ctx) =>
  c.hasDealership
    ? `${c.org} uses Mahanex Pulse, a delivery-coordination service provided by ${MAHANEX.name}. ${MAHANEX.name} provides the software and handles information on behalf of ${c.org} as its service provider.`
    : `Mahanex Pulse is a delivery-coordination service provided by ${MAHANEX.name} to car dealerships. Each dealership is responsible for the information it enters and for its own staff accounts, and ${MAHANEX.name} handles that information on the dealership's behalf as its service provider.`;

// ---------------------------------------------------------------------------

function privacy(c: Ctx): LegalDoc {
  return {
    title: 'Privacy notice',
    summary: `How ${c.orgShort} and Mahanex Pulse handle personal information.`,
    sections: [
      {
        id: 'about',
        heading: 'About this notice',
        blocks: [
          providerLine(c),
          'Mahanex Pulse is used by dealership staff to schedule vehicle deliveries, track what each delivery still needs, and send reminders. Customers do not use Pulse themselves. This notice explains what personal information Pulse holds, why, who can see it, and the choices you have.',
        ],
      },
      {
        id: 'information',
        heading: 'What information Pulse holds',
        blocks: [
          { list: [
            'Staff accounts: your name, role, sign-in (a work email or username), an optional email address for notifications, whether notifications are turned on for your devices, and activity in the app such as requirements you complete, comments you post, and delivery counts used to track sales bonuses.',
            'Delivery records entered by dealership staff: a customer\'s name, the vehicle and its stock number and VIN, the lender or lessor and approval status, the delivery date and time, any amount due or refunded at delivery, and notes or comments about the delivery.',
            'Technical details such as IP address and browser type, which appear in ordinary server logs whenever any website or app is used.',
          ] },
          'Pulse does not store a customer\'s email address, phone number, home address or payment card details. When a salesperson sends a customer a thank-you message, Pulse drafts the text and the salesperson sends it from their own email; Pulse does not send email to customers. Pulse has no advertising, analytics or tracking of any kind, and information is never sold.',
        ],
      },
      {
        id: 'why',
        heading: 'Why the information is used',
        blocks: [
          { list: [
            'To schedule deliveries and show each person the work that is theirs.',
            'To remind staff about upcoming, overdue and incomplete deliveries by notification or email, and to let managers follow up.',
            'To produce reports, such as monthly delivery reports and bonus tracking, for the people entitled to them.',
            'To keep the service secure, fix problems and provide support.',
          ] },
          'Information is used only for these purposes, or for purposes the law allows or requires.',
        ],
      },
      {
        id: 'access',
        heading: 'Who can see it',
        blocks: [
          c.hasDealership
            ? `Access is limited by role and by dealership. Staff of ${c.orgShort} see what their role needs: salespeople see their own deliveries; finance managers, sales managers and general managers see the dealership's deliveries. Staff of other dealerships cannot see it.`
            : 'Access is limited by role and by dealership. Staff see what their role needs, and staff of one dealership cannot see another dealership\'s information.',
          `${MAHANEX.name} administrators can access information when needed to operate, support and secure the service.`,
        ],
      },
      {
        id: 'providers',
        heading: 'Service providers and where information is kept',
        blocks: [
          { list: [
            'Database and sign-in: Supabase, with the database hosted in Canada.',
            'Hosting of the app\'s web files: GitHub Pages (United States).',
            'Email delivery (reminder and notification emails to staff): Resend.',
            'Push notifications: delivered through the browser or device maker\'s own service (for example Google, Apple, Microsoft or Mozilla).',
          ] },
          'Some of these providers may process information outside Canada, where it may be subject to the laws of that country, including access by its courts and authorities. They may use the information only to provide their service to us.',
        ],
      },
      {
        id: 'retention',
        heading: 'How long it is kept',
        blocks: [
          `Delivery records are kept for as long as ${c.hasDealership ? c.org : 'the dealership'} needs them to run its business and meet legal and record-keeping requirements, and are then deleted or anonymized. Staff accounts are removed, or deactivated if they are tied to records, when someone leaves the dealership.`,
        ],
      },
      {
        id: 'safeguards',
        heading: 'How it is protected',
        blocks: [
          'Sign-in is required, access is limited by role and dealership, passwords are stored in protected form, and connections to the service are encrypted. No system is perfectly secure, but we take reasonable steps to protect information and to respond if something goes wrong.',
        ],
      },
      {
        id: 'rights',
        heading: 'Your choices and rights',
        blocks: [
          `${c.privacyLaw} gives you rights over your personal information. You can ask to see the information held about you, ask for it to be corrected, ask a question about how it is handled, or withdraw consent where consent is the basis for using it. To make a request or raise a concern, ${c.howToReach}${MAHANEX.contactEmail ? `, or contact ${MAHANEX.name} at ${MAHANEX.contactEmail}` : ''}.`,
          'You can turn notifications off at any time in your device or browser settings. If you are not satisfied with a response, you can complain to ' + c.commissioner + '.',
        ],
      },
      {
        id: 'cookies',
        heading: 'Cookies and tracking',
        blocks: ['Pulse sets no cookies and uses no tracking. It stores a few settings in your browser so the app works; see the Cookies & storage page for the list.'],
      },
      {
        id: 'changes',
        heading: 'Changes to this notice',
        blocks: [`We may update this notice. The date at the top shows when it was last changed (${formatDate(LEGAL_UPDATED)}).`],
      },
    ],
  };
}

// ---------------------------------------------------------------------------

function terms(c: Ctx): LegalDoc {
  return {
    title: 'Terms of use',
    summary: `The rules for using Mahanex Pulse${c.hasDealership ? ` at ${c.orgShort}` : ''}.`,
    sections: [
      {
        id: 'who',
        heading: 'Who these terms are for',
        blocks: [
          c.hasDealership
            ? `These terms apply to you as a member of staff of ${c.org} ("the dealership") when you use Mahanex Pulse. The dealership makes Pulse available to you; ${MAHANEX.name} provides the software. By signing in you agree to these terms and acknowledge the Privacy notice.`
            : `These terms apply to staff of dealerships that use Mahanex Pulse. Your dealership gives you access; ${MAHANEX.name} provides the software. By signing in you agree to these terms and acknowledge the Privacy notice.`,
          'The dealership\'s own agreement with Mahanex, if there is one, also applies to the dealership.',
        ],
      },
      {
        id: 'account',
        heading: 'Your account',
        blocks: [
          { list: [
            'Your account is for you alone. Do not share your password or let someone else use your account.',
            'Keep your sign-in details secure and tell your manager straight away if you think someone else has used your account.',
            'The dealership decides who has an account and what role they have, and can change or remove access at any time.',
          ] },
        ],
      },
      {
        id: 'use',
        heading: 'Using Pulse properly',
        blocks: [
          { list: [
            'Use Pulse only for the dealership\'s work.',
            'Enter accurate information, and only what is needed. Pulse does not need a customer\'s contact details or payment information, so do not enter them.',
            'Look only at information you need for your job, and respect customers\' and colleagues\' privacy.',
            'Do not try to get into another person\'s account or another dealership\'s information, interfere with the service, or use it in a way that breaks the law.',
          ] },
          'You are responsible for how you use the messages Pulse drafts for you, including following the law and the dealership\'s policies when you send them to customers.',
        ],
      },
      {
        id: 'notifications',
        heading: 'Reminders and notifications',
        blocks: ['Reminders and notifications depend on your device settings, network and browser, and can be delayed or missed. Do not rely on them as the only way of keeping track of a delivery.'],
      },
      {
        id: 'service',
        heading: 'The service',
        blocks: [
          'Pulse is provided as it is and as it is available. It may be updated, interrupted for maintenance, or changed. We work to keep it running well but cannot promise it will always be available or free of errors.',
        ],
      },
      {
        id: 'ownership',
        heading: 'Ownership',
        blocks: [
          `The delivery information in Pulse belongs to ${c.hasDealership ? c.org : 'the dealership'}. The software, and the names Mahanex, Mahan-Ex and Mahanex Pulse, belong to ${MAHANEX.name}. You may use the software as allowed here and by your dealership, and no more.`,
        ],
      },
      {
        id: 'liability',
        heading: 'Limits on liability',
        blocks: [
          `To the extent the law allows, ${MAHANEX.name}${c.hasDealership ? ` and ${c.orgShort}` : ' and the dealership'} are not responsible for indirect or consequential losses, such as lost sales or missed deliveries, arising from using or not being able to use Pulse. Nothing in these terms limits any right you have that the law does not allow to be limited.`,
        ],
      },
      {
        id: 'ending',
        heading: 'Ending access',
        blocks: ['Access may be suspended or ended if these terms are broken, if the dealership asks, or when you leave the dealership.'],
      },
      {
        id: 'law',
        heading: 'Governing law',
        blocks: [`These terms are governed by the laws of ${c.provinceName} and the federal laws of Canada that apply there, and disputes are for the courts of ${c.provinceName}.`],
      },
      {
        id: 'changes',
        heading: 'Changes to these terms',
        blocks: [`We may update these terms. The date at the top shows when they were last changed (${formatDate(LEGAL_UPDATED)}). Continuing to use Pulse after a change means you accept it.`],
      },
    ],
  };
}

// ---------------------------------------------------------------------------

function cookies(c: Ctx): LegalDoc {
  return {
    title: 'Cookies & storage',
    summary: 'Pulse sets no cookies and has no tracking. Here is what it keeps in your browser.',
    sections: [
      {
        id: 'short',
        heading: 'The short version',
        blocks: [
          `Mahanex Pulse${c.hasDealership ? ` as used at ${c.orgShort}` : ''} sets no cookies and has no analytics, advertising or tracking. It loads no fonts, scripts or media from other companies; the only outside services it talks to are the ones that run it, listed in the Privacy notice. Because it only stores what it needs to work, it does not show a cookie consent banner.`,
        ],
      },
      {
        id: 'stored',
        heading: 'What is stored in your browser',
        blocks: [
          { list: [
            'Sign-in session: keeps you signed in. It is removed when you sign out.',
            'Appearance: your light or dark choice (pulse_theme).',
            'Layout: whether you prefer the board or list view on the home screen (pulse_home_view).',
            'Install prompt: remembers that you dismissed the "install the app" suggestion (pulse_install_prompt_dismissed).',
            'Administrators only: the role and dealership being previewed (pulse_acting_role, pulse_acting_dealership, pulse_acting_salesperson).',
            'App files: a saved copy of the app so it opens quickly and keeps working with a weak connection.',
          ] },
          'If you turn on notifications, your browser creates a notification address for your device, which is stored on our server so reminders can reach you. You can turn notifications off in your browser or device settings.',
        ],
      },
      {
        id: 'third',
        heading: 'Other companies',
        blocks: [
          'No advertising, analytics or social-media services are loaded. Links in the app, such as an address that opens in a maps service, only go to that service if you tap them.',
        ],
      },
      {
        id: 'control',
        heading: 'Your control',
        blocks: [
          'You can clear everything stored by the app at any time from your browser\'s site settings, or by signing out and removing the installed app. Clearing it signs you out and resets your preferences.',
        ],
      },
      {
        id: 'more',
        heading: 'More information',
        blocks: ['See the Privacy notice for how information in Pulse is used and protected.'],
      },
    ],
  };
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}
