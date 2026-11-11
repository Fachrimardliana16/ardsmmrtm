/**
 * Request validation rules — mirrors TRD §3 payload contracts.
 */

const RANKS = [
    'Master / Captain',
    'Chief Officer / 2nd Mate',
    'Chief Engineer',
    '2nd Engineer / 3rd Engineer',
    'Able Seaman (AB) / Bosun',
    'Oiler / Fitter',
    'Chief Cook / Steward'
];

const VESSEL_TYPES = ['Container', 'Tanker', 'Bulk', 'Offshore', 'Cruise'];

const seafarerRules = {
    name: { label: 'Full name', required: true, minLength: 3, maxLength: 120 },
    email: { label: 'Email', required: true, type: 'email', maxLength: 160 },
    phone: {
        label: 'Phone / WhatsApp',
        required: true,
        minLength: 7,
        maxLength: 24,
        pattern: /^[+()\d\s-]+$/,
        patternMessage: 'Phone number may only contain digits, spaces, +, -, and parentheses.'
    },
    applied_rank: { label: 'Applied rank', required: true, enum: RANKS },
    vessel_experience: { label: 'Vessel experience', required: false, maxLength: 60 },
    certifications: { label: 'Certifications', required: false, type: 'array' }
};

const principalRules = {
    company_name: { label: 'Company name', required: true, minLength: 2, maxLength: 160 },
    email: { label: 'Contact email', required: true, type: 'email', maxLength: 160 },
    vessel_type: { label: 'Vessel type', required: true, enum: VESSEL_TYPES },
    joining_date: { label: 'Joining date', required: true, type: 'date' },
    required_ranks: { label: 'Required ranks', required: true, minLength: 5, maxLength: 2000 },
    contract_duration: { label: 'Contract duration', required: false, maxLength: 60 },
    flag_state: { label: 'Flag state', required: false, maxLength: 80 }
};

const contactRules = {
    name: { label: 'Full name', required: true, minLength: 2, maxLength: 120 },
    email: { label: 'Email', required: true, type: 'email', maxLength: 160 },
    message: { label: 'Message', required: true, minLength: 10, maxLength: 4000 }
};

const newsletterRules = {
    email: { label: 'Email', required: true, type: 'email', maxLength: 160 }
};

module.exports = {
    RANKS,
    VESSEL_TYPES,
    seafarerRules,
    principalRules,
    contactRules,
    newsletterRules
};