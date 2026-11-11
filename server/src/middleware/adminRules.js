/**
 * Admin route rules — validation payloads for the management API.
 * Shape matches the declarative validator (see middleware/validate.js).
 */

const JOB_CATEGORIES = ['deck', 'engine', 'hotel'];
const JOB_STATUSES = ['open', 'closed', 'filled'];
const VESSEL_TYPES = ['Container', 'Tanker', 'Bulk', 'LNG', 'Offshore', 'Cruise'];

const jobRules = {
    title: { label: 'Position title', required: true, minLength: 3, maxLength: 120 },
    category: { label: 'Department', required: true, enum: JOB_CATEGORIES },
    vessel_type: { label: 'Vessel type', required: true, enum: VESSEL_TYPES },
    principal: { label: 'Principal', required: true, minLength: 3, maxLength: 140 },
    vessel_name: { label: 'Vessel name', maxLength: 80 },
    flag_state: { label: 'Flag state', maxLength: 60 },
    joining_date: { label: 'Joining date', type: 'date' },
    contract_duration: { label: 'Contract duration', maxLength: 60 },
    salary_min: { label: 'Minimum salary', type: 'number', min: 0 },
    salary_max: { label: 'Maximum salary', type: 'number', min: 0 },
    salary_currency: { label: 'Salary currency', maxLength: 8 },
    status: { label: 'Status', enum: JOB_STATUSES }
};

const jobPatchRules = {
    title: { label: 'Position title', minLength: 3, maxLength: 120 },
    category: { label: 'Department', enum: JOB_CATEGORIES },
    vessel_type: { label: 'Vessel type', enum: VESSEL_TYPES },
    principal: { label: 'Principal', minLength: 3, maxLength: 140 },
    vessel_name: { label: 'Vessel name', maxLength: 80 },
    flag_state: { label: 'Flag state', maxLength: 60 },
    joining_date: { label: 'Joining date', type: 'date' },
    contract_duration: { label: 'Contract duration', maxLength: 60 },
    salary_min: { label: 'Minimum salary', type: 'number', min: 0 },
    salary_max: { label: 'Maximum salary', type: 'number', min: 0 },
    salary_currency: { label: 'Salary currency', maxLength: 8 },
    status: { label: 'Status', enum: JOB_STATUSES }
};

const loginRules = {
    user: { label: 'Email or username', required: true, maxLength: 200 },
    password: { label: 'Password', required: true, maxLength: 200 }
};

const SEAFARER_STATUSES = ['new', 'screening', 'verified', 'rejected', 'proposed'];

const seafarerPatchRules = {
    status: { label: 'Status', required: true, enum: SEAFARER_STATUSES },
    notes: { label: 'Notes', maxLength: 2000 }
};

module.exports = {
    jobRules,
    jobPatchRules,
    loginRules,
    JOB_CATEGORIES,
    JOB_STATUSES,
    VESSEL_TYPES,
    SEAFARER_STATUSES,
    seafarerPatchRules
};