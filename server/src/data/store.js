/**
 * Ardson Maritime — In-memory store
 *
 * Seed data + CRUD for all entities.
 * Supports public site (jobs, registration forms) and admin portal.
 *
 * Field names are the single source of truth shared with the API
 * responses and the frontend (js/app.js, js/admin.js).
 */

const SEED_JOBS = [
    {
        id: 'AM-JOB-1001',
        title: 'Master / Captain',
        category: 'deck',
        vessel_type: 'Container',
        vessel_name: 'MV Pacific Line',
        principal: 'Pacific Shipping Ltd.',
        flag_state: 'Singapore',
        salary_min: 8200,
        salary_max: 9000,
        salary_currency: 'USD',
        contract_duration: '4 months',
        joining_date: '2026-12-05',
        status: 'open',
        posted_at: '2026-10-15T08:00:00Z'
    },
    {
        id: 'AM-JOB-1002',
        title: 'Chief Engineer',
        category: 'engine',
        vessel_type: 'Tanker',
        vessel_name: 'MV Horizon',
        principal: 'Horizon Tankers S.A.',
        flag_state: 'Greece',
        salary_min: 9500,
        salary_max: 10200,
        salary_currency: 'USD',
        contract_duration: '3 months',
        joining_date: '2026-12-12',
        status: 'open',
        posted_at: '2026-10-18T09:30:00Z'
    },
    {
        id: 'AM-JOB-1003',
        title: 'Able Seaman (AB)',
        category: 'deck',
        vessel_type: 'Bulk',
        vessel_name: 'MV Global Fleet',
        principal: 'Global Maritime Fleet',
        flag_state: 'Japan',
        salary_min: 1800,
        salary_max: 2100,
        salary_currency: 'USD',
        contract_duration: '6 months',
        joining_date: '2026-11-28',
        status: 'open',
        posted_at: '2026-10-20T11:00:00Z'
    },
    {
        id: 'AM-JOB-1004',
        title: 'Chief Cook',
        category: 'hotel',
        vessel_type: 'Cruise',
        vessel_name: 'MV Royal Ocean',
        principal: 'Royal Ocean Cruises',
        flag_state: 'USA',
        salary_min: 2400,
        salary_max: 2800,
        salary_currency: 'USD',
        contract_duration: '5 months',
        joining_date: '2026-12-20',
        status: 'open',
        posted_at: '2026-10-22T14:15:00Z'
    },
    {
        id: 'AM-JOB-1005',
        title: '2nd Engineer',
        category: 'engine',
        vessel_type: 'Offshore',
        vessel_name: 'MV Trident',
        principal: 'Trident Offshore Services',
        flag_state: 'UAE',
        salary_min: 4500,
        salary_max: 5200,
        salary_currency: 'USD',
        contract_duration: '4 months',
        joining_date: '2026-12-01',
        status: 'open',
        posted_at: '2026-10-25T10:00:00Z'
    },
    {
        id: 'AM-JOB-1006',
        title: '2nd Officer',
        category: 'deck',
        vessel_type: 'LNG',
        vessel_name: 'MV Trans-Global',
        principal: 'Trans-Global Shipping',
        flag_state: 'United Kingdom',
        salary_min: 5000,
        salary_max: 5800,
        salary_currency: 'USD',
        contract_duration: '4 months',
        joining_date: '2026-12-08',
        status: 'open',
        posted_at: '2026-10-28T16:00:00Z'
    }
];

const SEED_SEAFARERS = [
    {
        id: 'sea-001',
        reference: 'AM-2026-00991',
        name: 'Budi Santoso',
        email: 'budi.santoso@maritime.id',
        phone: '+6281234567890',
        applied_rank: 'Master / Captain',
        vessel_experience: 'Container',
        certifications: ['BST', 'Passport & Seaman Book', 'MCU Medical'],
        cv_file: null,
        status: 'verified',
        created_at: '2026-10-28T09:00:00Z'
    },
    {
        id: 'sea-002',
        reference: 'AM-2026-00992',
        name: 'Agus Wijaya',
        email: 'agus.wijaya@outlook.com',
        phone: '+6281398765432',
        applied_rank: 'Chief Engineer',
        vessel_experience: 'Oil Tanker',
        certifications: ['BST', 'Passport & Seaman Book', 'Advanced Tanker CoP', 'MCU Medical'],
        cv_file: null,
        status: 'screening',
        created_at: '2026-10-29T11:20:00Z'
    },
    {
        id: 'sea-003',
        reference: 'AM-2026-00993',
        name: 'Rahmat Hidayat',
        email: 'rahmat.h@seaman.id',
        phone: '+6282112345678',
        applied_rank: 'Able Seaman (AB) / Bosun',
        vessel_experience: 'Bulk Carrier',
        certifications: ['BST', 'Passport & Seaman Book'],
        cv_file: null,
        status: 'new',
        created_at: '2026-11-01T14:45:00Z'
    },
    {
        id: 'sea-004',
        reference: 'AM-2026-00994',
        name: 'Dedi Kurniawan',
        email: 'dedi.kurnia@gmail.com',
        phone: '+6285712344321',
        applied_rank: 'Chief Cook / Steward',
        vessel_experience: 'Cruise',
        certifications: ['BST', 'Passport & Seaman Book', 'MCU Medical'],
        cv_file: null,
        status: 'proposed',
        created_at: '2026-11-03T16:10:00Z'
    }
];

const SEED_REQUESTS = [
    {
        id: 'req-001',
        reference: 'AMR-2026-00981',
        company_name: 'Pacific Shipping Ltd.',
        email: 'crewing@pacificship.sg',
        vessel_type: 'Container',
        joining_date: '2026-12-05',
        required_ranks: '1 Master, 1 Chief Engineer, 2 AB. Port: Singapore.',
        contract_duration: '4 months',
        flag_state: 'Singapore',
        status: 'processing',
        created_at: '2026-10-25T10:00:00Z'
    },
    {
        id: 'req-002',
        reference: 'AMR-2026-00982',
        company_name: 'Horizon Tankers S.A.',
        email: 'crewing@horizontankers.gr',
        vessel_type: 'Tanker',
        joining_date: '2026-12-12',
        required_ranks: '1 Chief Engineer (MAN ME-C experience), 1 2nd Engineer.',
        contract_duration: '3 months',
        flag_state: 'Liberia',
        status: 'new',
        created_at: '2026-10-30T13:30:00Z'
    }
];

const SEED_CONTACTS = [
    {
        id: 'cnt-001',
        name: 'Capt. Marcus Vance',
        email: 'm.vance@vancemanagement.co.uk',
        message: 'Looking to establish a long-term crewing partnership for our 8 bulker fleet. Are Indonesian officers available with Greek flag endorsements?',
        status: 'read',
        created_at: '2026-10-27T08:15:00Z'
    },
    {
        id: 'cnt-002',
        name: 'Hendra Gunawan',
        email: 'hendra.gunawan@maritime.id',
        message: 'Inquiring about STCW revalidation schedule in Purbalingga training center. Can I register next week?',
        status: 'unread',
        created_at: '2026-11-04T09:40:00Z'
    }
];

const SEED_SUBSCRIBERS = [
    { email: 'seafarer.john@gmail.com', subscribed_at: '2026-10-10T10:00:00Z' },
    { email: 'capt.suryo@seaman.id', subscribed_at: '2026-10-15T12:00:00Z' },
    { email: 'maritime.career@outlook.com', subscribed_at: '2026-10-20T14:30:00Z' },
    { email: 'crewing.director@pacificship.sg', subscribed_at: '2026-10-25T16:00:00Z' }
];

/* ---------------- Site & hero settings ---------------- */
const DEFAULT_SETTINGS = {
    site: {
        name: 'Ardson Maritime',
        tagline: 'Career Center',
        description: 'Ardson Maritime Career Center — Indonesian maritime manning agency connecting STCW-verified seafarers with international shipowners. Free registration under MLC 2006.',
        favicon: 'assets/favicon.svg',
        logo: '',
        email: 'ardsonmaritime@outlook.com',
        phone: '(+62) 852-1125-4485',
        phone_link: '+6285211254485',
        address: 'Purbalingga, Central Java, Indonesia',
        hours: 'Mon–Fri 08:00–17:00 WIB · Sat 08:00–13:00 WIB',
        city: 'Purbalingga',
        region: 'Central Java',
        country: 'Indonesia',
        latitude: -7.3058,
        longitude: 109.3654,
        site_url: 'https://www.ardsonmaritime.com',
        social: { facebook: '', instagram: '', linkedin: '' }
    },
    hero: {
        image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=85&w=2400',
        slides: [
            {
                id: 'slide-001',
                type: 'image',
                image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=85&w=2400',
                video: '',
                video_fallback: '',
                poster: '',
                duration: 7000,
                eyebrow: 'Indonesian Maritime Manning Agency',
                title: 'Verified seafarers,',
                title_accent: "ready for the world's fleets",
                lede: 'Ardson Maritime connects Indonesian officers and ratings with international shipowners. Every candidate is screened against STCW 2010 requirements, with certificates, sea service, and medical fitness verified before embarkation.',
                badge_title: 'MLC 2006 compliant',
                badge_text: 'Zero recruitment fees for seafarers'
            },
            {
                id: 'slide-002',
                type: 'image',
                image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=85&w=2400',
                video: '',
                video_fallback: '',
                poster: '',
                duration: 7000,
                eyebrow: 'STCW 2010 Verified Crew',
                title: 'Officers and ratings,',
                title_accent: 'screened to international standards',
                lede: 'Document authenticity, sea service records, medical fitness, and English proficiency are all verified before a candidate joins your fleet.',
                badge_title: 'Rigorous screening',
                badge_text: 'Marlins testing on every placement'
            },
            {
                id: 'slide-003',
                type: 'image',
                image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&q=85&w=2400',
                video: '',
                video_fallback: '',
                poster: '',
                duration: 7000,
                eyebrow: 'Across the World’s Fleets',
                title: 'Crew mobilisation,',
                title_accent: 'fast and fully compliant',
                lede: 'From emergency replacement to rapid mobilisation, we keep your vessels manned with qualified, document-ready Indonesian seafarers.',
                badge_title: 'Emergency replacement',
                badge_text: '24/7 crewing desk support'
            }
        ],
        transition: 'fade',
        autoplay: true,
        pause_on_hover: true,
        show_dots: true,
        show_arrows: true,
        eyebrow: 'Indonesian Maritime Manning Agency',
        title: 'Verified seafarers,',
        title_accent: "ready for the world's fleets",
        lede: 'Ardson Maritime connects Indonesian officers and ratings with international shipowners. Every candidate is screened against STCW 2010 requirements, with certificates, sea service, and medical fitness verified before embarkation.',
        secondary_label: 'Submit crew requirement',
        secondary_href: '#',
        badge_title: 'MLC 2006 compliant',
        badge_text: 'Zero recruitment fees for seafarers'
    },
    /**
     * Per-page overrides edited from Settings → Pages. Empty object means
     * every page keeps the copy baked into its HTML file.
     */
    pages: {},
    /**
     * Reusable content blocks rendered by js/site.js. Stored here so the
     * admin console can edit them without rebuilding the static pages.
     */
    blocks: {
        audience: {
            eyebrow: 'Get started',
            title: 'Choose your path',
            lede: 'Seafarers: create a free profile and apply for open contracts. Principals: submit a crewing requirement and receive a screened shortlist. Both forms take about five minutes.',
            items: [
                {
                    key: 'seafarers',
                    tag: 'For seafarers',
                    title: 'Your next voyage starts here',
                    text: 'Build a professional mariner profile, upload your STCW certificates and sea service records, then apply for verified contracts across container, tanker, offshore, and cruise fleets.',
                    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=900',
                    bullets: [
                        'Direct placement with certified shipowners',
                        'Free application, no recruitment fees',
                        'Documentation and visa assistance to joining'
                    ],
                    primary_label: 'Register as seafarer',
                    secondary_label: 'How registration works',
                    secondary_href: 'seafarers.html'
                },
                {
                    key: 'principals',
                    tag: 'For principals',
                    title: 'Crew that meet your standard',
                    text: 'We source officers and ratings with verified backgrounds, including document authenticity, sea service records, medical fitness, and English proficiency.',
                    image: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&q=80&w=900',
                    bullets: [
                        'Rigorous screening and Marlins testing',
                        'STCW 2010 and MLC 2006 compliance',
                        'Emergency replacement and rapid mobilisation'
                    ],
                    primary_label: 'Submit crew request',
                    secondary_label: 'See crewing services',
                    secondary_href: 'principals.html'
                }
            ]
        },
        trust: {
            eyebrow: 'Compliance',
            title: 'Verified at every step',
            items: [
                { title: '100% verified', text: 'Every certificate and sea-service record checked before embarkation' },
                { title: 'STCW 2010', text: 'Training and certification aligned with the Manila amendments' },
                { title: 'MLC 2006', text: 'Zero-fee recruitment and seafarer rights protection' },
                { title: 'Global network', text: 'Principals across Asia, Europe, the Middle East, and beyond' }
            ]
        },
        training: {
            eyebrow: 'Professional development',
            title: 'Training and certification',
            lede: 'Guidance for Indonesian seafarers to keep qualifications aligned with industry requirements and flag state expectations.',
            link_label: 'All programmes',
            link_href: 'training.html',
            items: [
                { num: '01', title: 'Safety readiness & STCW', text: 'Support for BST, SCRB, AFF, MEFA, and revalidation courses at accredited maritime training institutes.', link_label: 'Explore programme', link_href: 'training.html#stcw' },
                { num: '02', title: 'Tanker & special certificates', text: 'Guidance for Gas (LPG/LNG), Oil, and Chemical tanker endorsements at basic and advanced levels.', link_label: 'Explore programme', link_href: 'training.html#tanker' },
                { num: '03', title: 'Maritime English & Marlins', text: 'Preparation for the Marlins Test and Standard Marine Communication Phrases ahead of principal interviews.', link_label: 'Explore programme', link_href: 'training.html#english' }
            ]
        },
        faq: {
            eyebrow: 'Before you write',
            title: 'Answers to the questions we get most',
            items: [
                { title: 'Do you charge seafarers a fee?', text: 'No. Placement is paid by the principal. Under MLC 2006, no manning agency may charge a seafarer for recruitment or placement.' },
                { title: 'How long does registration take?', text: 'The form takes about five minutes. Document verification is usually completed within two working days.' },
                { title: 'Which ranks do you place?', text: 'Deck, engine, and hotel ranks from ratings to master and chief engineer, across container, tanker, gas, bulk, offshore, and cruise tonnage.' },
                { title: 'How fast can a crew request be answered?', text: 'A first shortlist is typically returned within one working day of receiving a complete specification.' }
            ]
        },
        stepsSeafarers: {
            eyebrow: 'The process',
            title: 'How registration works',
            lede: 'Most placements complete within four to six weeks of a complete profile.',
            items: [
                { title: 'Register', text: 'Complete the registration form with your rank, vessel experience, and certificate status. Upload a CV or sea service record.' },
                { title: 'Verification', text: 'Our crewing team reviews your documents and confirms which flag endorsements you still need.' },
                { title: 'Interview', text: "A technical interview with the principal's superintendent, plus a Marlins or equivalent English test." },
                { title: 'Joining', text: 'Contract signed under MLC 2006, visa and endorsement processed, ticket issued, joining confirmed in writing.' }
            ]
        },
        stepsPrincipals: {
            eyebrow: 'Engagement model',
            title: 'How a crew request runs',
            lede: 'From your specification to joining, typically under 30 days for ratings and 45 days for senior officers.',
            items: [
                { title: 'Send the specification', text: 'Ranks, vessel type, flag, joining port, and contract terms. A short call confirms the standing orders and interview format.' },
                { title: 'Candidate proposal', text: 'Within 24 hours we return a shortlist with CVs, certificate status, sea service, and Marlins scores.' },
                { title: 'Interview and selection', text: 'Interviews arranged around your time zone. We coordinate technical assessments and reference checks.' },
                { title: 'Mobilisation', text: 'Contract, visa, flag endorsement, medical, and travel handled end to end, with a joining report before departure.' }
            ]
        },
        stepsEmergency: {
            eyebrow: '01 — How it works',
            title: 'Four steps from gap to gangway',
            lede: "A 24/7 duty desk receives the request, pulls a verified stand-by from the pool, and handles documentation and travel in parallel so the joining date doesn't slip.",
            items: [
                { title: '1 · Request received', text: 'The duty desk acknowledges inside 30 minutes and confirms the rank, vessel, port, and target joining.' },
                { title: '2 · Candidate proposed', text: "Within 6 hours we send 1–3 verified stand-bys with valid Seaman's Book, CoC, medical, and visas already checked." },
                { title: '3 · Travel booked', text: 'Flights, hotel, and shore transfer booked same day. Flag-state and port-state notifications prepared.' },
                { title: '4 · Handover complete', text: 'Relief crew signs on at the agreed port; handover brief with outgoing officer documented for the master.' }
            ]
        }
    },
    /**
     * Help centre page content, edited from the admin console.
     * Intro copy only — the step-by-step sections stay in the page
     * partial because they contain SVGs and structured markup.
     */
    help: {
        eyebrow: 'Help centre',
        title: 'Step-by-step guides for seafarers and principals',
        lede: 'Short walkthroughs for registering, uploading documents, applying for a vacancy, and submitting a crew request. Most tasks take under five minutes.',
        contact_note: 'Still stuck? Email ardsonmaritime@outlook.com and our crewing team replies within one working day.'
    },
    /**
     * Header profile button. `mode` is one of:
     *   'profile' — link to profile.html (default)
     *   'modal'   — open the seafarer registration modal
     *   'hidden'  — hide the button entirely
     */
    profile_button: {
        enabled: true,
        mode: 'profile',
        label: 'My profile',
        href: 'profile.html'
    },
    /**
     * Help button in the header, managed from the admin console.
     */
    help_button: {
        enabled: true,
        label: 'Help and tutorials',
        href: 'help.html'
    }
};

const clone = (value) => JSON.parse(JSON.stringify(value));
let settings = clone(DEFAULT_SETTINGS);

/* ---------------- Maritime Insight articles ---------------- */
const SEED_INSIGHTS = [
    {
        id: 'ins-001',
        slug: 'navigating-career-opportunities-in-global-shipping',
        title: 'Navigating career opportunities in global shipping',
        tag: 'Career guide',
        date: '2026-09-24',
        read: '5 min read',
        image: 'https://images.unsplash.com/photo-1516214104703-d870798883c5?auto=format&fit=crop&q=80&w=1000',
        lede: 'International shipping underpins world trade. Learn how deck and engine officers can move into tanker and LNG fleets for long-term growth.',
        body: '<h2>Where the demand sits today</h2>\n<p>The global fleet keeps growing faster than the pipeline of qualified officers, and that gap is most obvious in tanker, gas carrier, and offshore tonnage. Shipping companies that once hired almost exclusively from Europe and the Philippines now source heavily from Indonesia, India, and Eastern Europe. For an Indonesian officer with a clean record and current certificates, that means more choice of vessels, flags, and salary packages than at any point in the last decade.</p>\n<p>Container shipping remains the largest single employer of deck and engine officers, but it is also the most cyclical. Tanker and LNG contracts tend to be longer and less exposed to the same demand swings, which is one reason we see officers use a container contract as a first step and then move into tankers once they have a couple of years of sea time behind them.</p>\n<h2>Building a credible seafaring CV</h2>\n<p>Ship managers read a CV for two things: can this person actually do the rank, and will they pass the principal\'s screening. Both come down to how clearly the sea service is laid out. Every contract should show the vessel type, gross tonnage, engine or kW, rank held, dates, and the flag state. Photocopies of the seaman\'s book and the discharge book do more for an application than a page of self-description.</p>\n<h3>Certificates that open doors</h3>\n<ul>\n<li>Certificate of Competency for the target rank, with STCW 2010 endorsements.</li>\n<li>Advanced tanker and gas qualifications (CoP) if you are aiming at tankers or LNG.</li>\n<li>MCU or equivalent medical fitness, ideally dated within the last twelve months.</li>\n<li>A Marlins test result or documented English proficiency, which most European principals now require.</li>\n</ul>\n<h2>From rating to officer</h2>\n<p>ABLE Seaman and Oiler who plan to sit for the officer-of-the-watch exam should tell their crewing agency early. Some principals fund OOW training and exams for ratings who have already proven themselves on board, especially on tankers where the bridge team is small and continuity is valuable.</p>\n<h2>Questions to ask before signing</h2>\n<p>Before accepting any contract, confirm the wage in writing, the currency, the contract length, the joining port, and who pays for the flight and visa. A reputable manning agency under MLC 2006 will not charge you a recruitment fee, will give you a written contract in English, and will not ask you to sign anything you have not read. If a middleman asks for cash up front, walk away.</p>',
        status: 'published',
        created_at: '2026-09-24T09:00:00Z'
    },
    {
        id: 'ins-002',
        slug: 'stcw-and-medical-document-checklist-for-2026',
        title: 'STCW and medical document checklist for 2026',
        tag: 'Certification',
        date: '2026-09-20',
        read: '4 min read',
        image: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&q=80&w=1000',
        lede: "Avoid joining delays by keeping flag state endorsements, yellow fever certificates, seaman's book renewals, and MLC contract verification current.",
        body: '<h2>Why documents fail at the gangway</h2>\n<p>The most common reason a seafarer misses a joining date is not a lack of experience. It is a certificate that lapsed three weeks before travel, a missing flag endorsement, or a medical certificate signed by a clinic the principal does not recognise. Almost every one of those is preventable with a checklist and a renewal diary.</p>\n<h2>The core set every officer should keep valid</h2>\n<ul>\n<li><strong>Certificate of Competency (CoC)</strong> for the rank held, plus the STCW 2010 endorsements for the flag state of the vessel you are joining.</li>\n<li><strong>Seaman\'s book</strong>, with at least six blank pages and validity extending past the contract end date.</li>\n<li><strong>Passport</strong>, also valid past the contract end date and ideally past twelve months beyond it.</li>\n<li><strong>Medical fitness certificate</strong> from a clinic approved by the flag state or the principal, normally valid for twelve months or two years depending on the issuing authority.</li>\n<li><strong>Basic Safety Training (BST)</strong>, refreshed within the past five years as required by STCW 2010.</li>\n</ul>\n<h2>Special certificates for special tonnage</h2>\n<p>Tanker officers need the appropriate Oil, Chemical, or Liquefied Gas familiarisation and advanced training certificates. Liquefied gas tonnage also expects a basic and advanced gas tanker certificate. Cruise and passenger vessel officers should confirm crowd management and crisis management requirements with the principal before joining.</p>\n<h3>Medical and travel documents</h3>\n<ul>\n<li>Yellow fever vaccination, if the itinerary includes countries on the WHO list.</li>\n<li>Marlins test result, or another recognised English proficiency certificate.</li>\n<li>A signed contract under MLC 2006, with wages, duration, and repatriation costs clearly stated.</li>\n</ul>\n<h2>Working with a manning agency</h2>\n<p>A legitimate agency under MLC 2006 does not charge seafarers a placement fee. We review every document against the principal\'s requirements before a candidate is proposed, tell you which certificates are about to lapse, and coordinate the visa, flag endorsement, and ticket. That is the standard Ardson Maritime holds itself to for every placement.</p>',
        status: 'published',
        created_at: '2026-09-20T09:00:00Z'
    },
    {
        id: 'ins-003',
        slug: 'how-indonesian-seafarers-can-stand-out-to-international-principals',
        title: 'How Indonesian seafarers can stand out to international principals',
        tag: 'Career guide',
        date: '2026-08-12',
        read: '5 min read',
        image: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&q=80&w=1000',
        lede: 'Maritime English, document hygiene, and sea-service records separate strong candidates from the rest of the pool.',
        body: '<h2>English is the working language</h2>\n<p>Almost every international principal now uses the Marlins test, or an equivalent, as part of the screening process. A score of 75% or above on Marlins is the practical threshold for officers joining European-owned tonnage. Crew who prepare for Marlins properly pass it on the first attempt, and that single score often decides whether an application gets forwarded.</p>\n<h2>Document hygiene</h2>\n<p>Principals screen applications against a shortlist of documents. Having them current, legible, and easy to find removes friction from the process. We advise every candidate to keep a single PDF folder with:</p>\n<ul>\n<li>Passport and seaman\'s book.</li>\n<li>Certificate of Competency and STCW endorsements.</li>\n<li>Medical fitness certificate.</li>\n<li>Latest Marlins test result.</li>\n<li>Sea service letters from each principal.</li>\n<li>Up-to-date CV, with each contract on one row.</li>\n</ul>\n<h2>Reputation compounds</h2>\n<p>Sea service on a well-known principal, with a clean discharge and a good reference, is worth more than a higher salary offer elsewhere. Re-hire priority is the fastest route to a better rank and a longer contract. Officers who treat each contract as a long-term audition do better over a career than those who chase the highest short-term pay.</p>',
        status: 'published',
        created_at: '2026-08-12T09:00:00Z'
    }
];
let insights = clone(SEED_INSIGHTS);
let insSeq = 3;
const nextInsId = () => 'ins-' + String(++insSeq).padStart(3, '0');

/* ---------------- Admin users & roles ---------------- */
let heroSlideSeq = 1;
const nextHeroSlideId = () => 'slide-' + String(++heroSlideSeq).padStart(3, '0');

/* ---------------- Admin users & roles ---------------- */
const PERMISSION_CATALOGUE = [
    { key: 'jobs.manage', label: 'Manage vacancies' },
    { key: 'seafarers.view', label: 'View seafarers' },
    { key: 'seafarers.manage', label: 'Manage seafarers' },
    { key: 'requests.view', label: 'View crew requests' },
    { key: 'contacts.view', label: 'View messages' },
    { key: 'newsletter.manage', label: 'Manage newsletter' },
    { key: 'settings.manage', label: 'Edit website settings' },
    { key: 'users.manage', label: 'Manage users & roles' },
    { key: 'backup.manage', label: 'Create and restore backups' },
    { key: 'logs.view', label: 'View activity and error logs' }
];

const SEED_ROLES = [
    {
        id: 'role-super',
        slug: 'super_admin',
        name: 'Super Admin',
        description: 'Full access to every console area, including users, roles, and backups.',
        permissions: ['*'],
        locked: true
    },
    {
        id: 'role-crewing',
        slug: 'crewing_officer',
        name: 'Crewing Officer',
        description: 'Day-to-day crewing: vacancies, candidates, crew requests, and messages.',
        permissions: ['jobs.manage', 'seafarers.view', 'seafarers.manage', 'requests.view', 'contacts.view'],
        locked: false
    },
    {
        id: 'role-editor',
        slug: 'content_editor',
        name: 'Content Editor',
        description: 'Website settings and the newsletter list. No candidate data.',
        permissions: ['settings.manage', 'newsletter.manage'],
        locked: false
    },
    {
        id: 'role-viewer',
        slug: 'viewer',
        name: 'Read Only',
        description: 'Read-only access to vacancies, candidates, and requests.',
        permissions: ['seafarers.view', 'requests.view', 'contacts.view'],
        locked: false
    }
];

const SEED_USERS = [
    {
        id: 'usr-001',
        name: 'Ardson Administrator',
        email: 'admin@ardsonmaritime.com',
        role: 'super_admin',
        status: 'active',
        created_at: '2026-09-01T08:00:00Z',
        last_login: '2026-11-09T07:42:00Z'
    },
    {
        id: 'usr-002',
        name: 'Crewing Desk',
        email: 'crewing@ardsonmaritime.com',
        role: 'crewing_officer',
        status: 'active',
        created_at: '2026-09-14T09:30:00Z',
        last_login: '2026-11-08T15:10:00Z'
    },
    {
        id: 'usr-003',
        name: 'Content Editor',
        email: 'editor@ardsonmaritime.com',
        role: 'content_editor',
        status: 'invited',
        created_at: '2026-10-22T11:05:00Z',
        last_login: null
    }
];

let roles = clone(SEED_ROLES);
let adminUsers = clone(SEED_USERS);
let userSeq = 100;

/* ---------------- Activity & error logs ---------------- */
let logSeq = 300;
const nextLogId = () => 'log-' + String(++logSeq);

const SEED_LOGS = [
    { id: 'log-301', level: 'info', actor: 'admin@ardsonmaritime.com', action: 'Signed in', target: 'admin console', detail: 'Session issued from 103.28.x.x', created_at: '2026-11-09T07:42:00Z' },
    { id: 'log-302', level: 'info', actor: 'admin@ardsonmaritime.com', action: 'Published vacancy', target: 'AM-JOB-1006', detail: '2nd Officer — LNG', created_at: '2026-11-08T16:04:00Z' },
    { id: 'log-303', level: 'warning', actor: 'system', action: 'Rate limit triggered', target: 'POST /api/v1/contact', detail: '21 requests in 10 minutes from 114.79.x.x', created_at: '2026-11-08T13:22:00Z' },
    { id: 'log-304', level: 'error', actor: 'system', action: 'Mailer delivery failed', target: 'notifier', detail: 'SMTP timeout after 10s — notification queued for retry', created_at: '2026-11-08T11:58:00Z' },
    { id: 'log-305', level: 'error', actor: 'system', action: 'Upload rejected', target: 'POST /api/v1/seafarers/register', detail: 'File "cv.exe" rejected — extension not allowed', created_at: '2026-11-07T19:31:00Z' },
    { id: 'log-306', level: 'info', actor: 'crewing@ardsonmaritime.com', action: 'Marked message read', target: 'cnt-001', detail: 'Capt. Marcus Vance', created_at: '2026-11-07T10:12:00Z' }
];

let logs = clone(SEED_LOGS);

/* ---------------- Backups ---------------- */
let backups = [
    { id: 'bak-001', filename: 'ardson-backup-2026-11-08.json', created_at: '2026-11-08T02:00:00Z', created_by: 'system', size_kb: 184, status: 'ready', counts: { jobs: 6, seafarers: 4, crewRequests: 2, contacts: 2, subscribers: 4 } },
    { id: 'bak-002', filename: 'ardson-backup-2026-11-01.json', created_at: '2026-11-01T02:00:00Z', created_by: 'system', size_kb: 171, status: 'ready', counts: { jobs: 6, seafarers: 3, crewRequests: 2, contacts: 2, subscribers: 3 } }
];
let backupSeq = 2;
// Full JSON payload per backup id (kept in memory alongside the metadata).
const backupPayloads = new Map();

let jobs = [...SEED_JOBS];
let seafarers = [...SEED_SEAFARERS];
let crewRequests = [...SEED_REQUESTS];
let contacts = [...SEED_CONTACTS];
let subscribers = [...SEED_SUBSCRIBERS];

let sequence = 1005;
const nextRef = (prefix) => `${prefix}-2026-${String(++sequence).padStart(5, '0')}`;

// Separate counter for job IDs so they never collide with the seeded
// AM-JOB-1001..1006 range (which is independent of `sequence`).
let jobSeq = 1006;
const nextJobId = () => 'AM-JOB-' + String(++jobSeq);

// Internal surrogate keys for non-job entities (distinct from the human
// reference like AM-2026-01006).
let idSeq = 100;
const nextId = (prefix) => `${prefix}-${++idSeq}`;

/* ---------------- Activity log helper ---------------- */
const MAX_LOGS = 500;

function recordLog(level, actor, action, target, detail) {
    const entry = {
        id: nextLogId(),
        level: ['info', 'warning', 'error'].includes(level) ? level : 'info',
        actor: actor || 'system',
        action: String(action || ''),
        target: String(target || ''),
        detail: String(detail || ''),
        created_at: new Date().toISOString()
    };
    logs.unshift(entry);
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
    return entry;
}

/* ---------------- Snapshot / restore ---------------- */
function snapshot() {
    return {
        settings: clone(settings),
        jobs: clone(jobs),
        seafarers: clone(seafarers),
        crewRequests: clone(crewRequests),
        contacts: clone(contacts),
        subscribers: clone(subscribers),
        adminUsers: clone(adminUsers),
        roles: clone(roles),
        insights: clone(insights)
    };
}

function countsOf(data) {
    return {
        jobs: data.jobs.length,
        seafarers: data.seafarers.length,
        crewRequests: data.crewRequests.length,
        contacts: data.contacts.length,
        subscribers: data.subscribers.length,
        insights: data.insights.length
    };
}

// Seed snapshots so the two pre-existing backups are restorable.
backups.forEach((b) => { if (!backupPayloads.has(b.id)) backupPayloads.set(b.id, snapshot()); });

module.exports = {
    /* ---------------- Jobs ---------------- */
    listJobs: (category) => {
        if (!category || category === 'all') return [...jobs];
        return jobs.filter(j => j.category === category);
    },
    listAllJobs: () => [...jobs],
    getJob: (id) => jobs.find(j => j.id === id) || null,
    createJob: (payload) => {
        const job = {
            id: nextJobId(),
            title: payload.title,
            category: payload.category || 'deck',
            vessel_type: payload.vessel_type || 'Container',
            vessel_name: payload.vessel_name || '',
            principal: payload.principal || '',
            flag_state: payload.flag_state || '',
            salary_min: Number(payload.salary_min) || 0,
            salary_max: Number(payload.salary_max) || 0,
            salary_currency: payload.salary_currency || 'USD',
            contract_duration: payload.contract_duration || '4 months',
            joining_date: payload.joining_date || new Date().toISOString().slice(0, 10),
            status: payload.status || 'open',
            posted_at: new Date().toISOString()
        };
        jobs.unshift(job);
        return job;
    },
    updateJob: (id, patch) => {
        const idx = jobs.findIndex(j => j.id === id);
        if (idx === -1) return null;
        jobs[idx] = { ...jobs[idx], ...patch };
        return jobs[idx];
    },
    deleteJob: (id) => {
        const idx = jobs.findIndex(j => j.id === id);
        if (idx === -1) return false;
        jobs.splice(idx, 1);
        return true;
    },

    /* ---------------- Seafarers ---------------- */
    createSeafarer: (data) => {
        const record = {
            id: nextId('srf'),
            reference: nextRef('AM'),
            name: data.name,
            email: data.email,
            phone: data.phone,
            applied_rank: data.applied_rank,
            vessel_experience: data.vessel_experience || 'Other',
            certifications: Array.isArray(data.certifications)
                ? data.certifications
                : (typeof data.certifications === 'string' ? JSON.parse(data.certifications) : []),
            cv_file: data.cv_file || null,
            status: 'new',
            created_at: new Date().toISOString()
        };
        seafarers.unshift(record);
        return record;
    },
    listSeafarers: () => [...seafarers],
    findSeafarer: (id) => seafarers.find((s) => s.id === id) || null,
    updateSeafarer: (id, patch) => {
        const record = seafarers.find((s) => s.id === id);
        if (!record) return null;
        const allowed = ['status', 'notes', 'screened_by', 'screened_at'];
        allowed.forEach((key) => {
            if (key in patch) record[key] = patch[key];
        });
        record.updated_at = new Date().toISOString();
        return record;
    },

    /* ---------------- Crew requests ---------------- */
    createCrewRequest: (data) => {
        const record = {
            id: nextId('creq'),
            reference: nextRef('AMR'),
            company_name: data.company_name,
            email: data.email,
            vessel_type: data.vessel_type,
            joining_date: data.joining_date,
            required_ranks: data.required_ranks,
            contract_duration: data.contract_duration || 'TBD',
            flag_state: data.flag_state || 'TBD',
            status: 'new',
            created_at: new Date().toISOString()
        };
        crewRequests.unshift(record);
        return record;
    },
    listCrewRequests: () => [...crewRequests],
    getCrewRequest: (id) => crewRequests.find(r => r.id === id) || null,
    updateCrewRequest: (id, patch = {}) => {
        const r = crewRequests.find(x => x.id === id);
        if (!r) return null;
        const allowed = ['status', 'notes', 'assigned_to'];
        allowed.forEach((key) => {
            if (patch[key] !== undefined) r[key] = patch[key];
        });
        r.updated_at = new Date().toISOString();
        return r;
    },

    /* ---------------- Contacts ---------------- */
    createContact: (data) => {
        const record = {
            id: nextId('msg'),
            name: data.name,
            email: data.email,
            message: data.message,
            status: 'unread',
            created_at: new Date().toISOString()
        };
        contacts.unshift(record);
        return record;
    },
    listContacts: () => [...contacts],
    markContactRead: (id) => {
        const r = contacts.find(c => c.id === id);
        if (!r) return null;
        r.status = 'read';
        return r;
    },
    updateContact: (id, patch = {}) => {
        const r = contacts.find(c => c.id === id);
        if (!r) return null;
        if (patch.status !== undefined) r.status = patch.status;
        if (patch.notes !== undefined) r.notes = patch.notes;
        r.updated_at = new Date().toISOString();
        return r;
    },

    /* ---------------- Newsletter ---------------- */
    createSubscriber: (email) => {
        const clean = String(email).trim().toLowerCase();
        if (!subscribers.some(s => s.email === clean)) {
            subscribers.unshift({ email: clean, subscribed_at: new Date().toISOString() });
        }
        return clean;
    },
    listSubscribers: () => [...subscribers].map(s => ({ email: s.email, subscribed_at: s.subscribed_at || null })),

    /* ---------------- Dashboard stats ---------------- */
    stats: () => ({
        openJobs: jobs.filter(j => j.status === 'open').length,
        totalJobs: jobs.length,
        seafarers: seafarers.length,
        crewRequests: crewRequests.length,
        openRequests: crewRequests.filter(r => !['fulfilled', 'closed'].includes(r.status)).length,
        unreadContacts: contacts.filter(c => c.status === 'unread').length,
        subscribers: subscribers.length,
        users: adminUsers.length,
        errors: logs.filter(l => l.level === 'error').length,
        insights: insights.filter(i => i.status === 'published').length
    }),

    /* ---------------- Maritime Insight articles ---------------- */
    listInsights: (opts = {}) => {
        let data = [...insights].sort((a, b) => String(b.date).localeCompare(String(a.date)));
        if (opts.public) data = data.filter(i => i.status === 'published');
        if (opts.tag) data = data.filter(i => i.tag === opts.tag);
        return data.map(i => i.body ? i : i);
    },
    getInsight: (id) => insights.find(i => i.id === id) || null,
    getInsightBySlug: (slug) => insights.find(i => i.slug === slug) || null,
    createInsight: (data) => {
        const title = String(data.title || '').trim();
        const slug = String(data.slug || title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
            || 'insight-' + (insSeq + 1);
        if (insights.some(i => i.slug === slug)) {
            return null;
        }
        const record = {
            id: nextInsId(),
            slug,
            title,
            tag: data.tag || 'Career guide',
            date: data.date || new Date().toISOString().slice(0, 10),
            read: data.read || '4 min read',
            image: data.image || '',
            lede: data.lede || '',
            body: data.body || '',
            status: data.status || 'draft',
            created_at: new Date().toISOString()
        };
        insights.unshift(record);
        return clone(record);
    },
    updateInsight: (id, patch) => {
        const idx = insights.findIndex(i => i.id === id);
        if (idx === -1) return null;
        if (patch.slug && insights.some(i => i.slug === patch.slug && i.id !== id)) {
            return { conflict: true };
        }
        if (patch.slug) patch.slug = String(patch.slug).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        insights[idx] = { ...insights[idx], ...patch };
        return clone(insights[idx]);
    },
    deleteInsight: (id) => {
        const idx = insights.findIndex(i => i.id === id);
        if (idx === -1) return false;
        insights.splice(idx, 1);
        return true;
    },

    /* ---------------- Settings ---------------- */
    getSettings: () => clone(settings),
    updateSettings: (section, patch) => {
        /* Never let a payload rewrite an object's prototype. */
        const source = patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {};
        const safeKeys = Object.keys(source).filter((key) => !['__proto__', 'constructor', 'prototype'].includes(key));
        const safe = {};
        safeKeys.forEach((key) => { safe[key] = source[key]; });

        if (section === 'site') {
            settings.site = {
                ...settings.site,
                ...safe,
                social: { ...settings.site.social, ...(safe.social || {}) }
            };
        } else if (section === 'hero') {
            settings.hero = { ...settings.hero, ...safe };
        } else if (section === 'help' || section === 'profile_button' || section === 'help_button') {
            settings[section] = { ...settings[section], ...safe };
        } else if (section === 'pages' || section === 'blocks') {
            const next = { ...(settings[section] || {}) };
            safeKeys.forEach((key) => {
                if (safe[key] == null) delete next[key];
                else next[key] = safe[key];
            });
            settings[section] = next;
        } else {
            return null;
        }
        return clone(settings);
    },
    resetSettings: (section) => {
        if (section && DEFAULT_SETTINGS[section]) {
            settings[section] = clone(DEFAULT_SETTINGS[section]);
        } else {
            settings = clone(DEFAULT_SETTINGS);
        }
        return clone(settings);
    },
    resetBlock: (key) => {
        if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS.blocks, key)) {
            settings.blocks[key] = clone(DEFAULT_SETTINGS.blocks[key]);
        }
        return clone(settings);
    },

    /* Hero slides live under settings.hero.slides. */
    listHeroSlides: () => clone(settings.hero.slides || []),
    createHeroSlide: (data) => {
        const slide = {
            id: nextHeroSlideId(),
            type: ['image', 'video', 'text'].includes(data.type) ? data.type : 'image',
            image: data.image || '',
            video: data.video || '',
            video_fallback: data.video_fallback || '',
            poster: data.poster || '',
            duration: Number(data.duration) || 7000,
            eyebrow: data.eyebrow || '',
            title: data.title || '',
            title_accent: data.title_accent || '',
            lede: data.lede || '',
            badge_title: data.badge_title || '',
            badge_text: data.badge_text || ''
        };
        settings.hero.slides = settings.hero.slides || [];
        settings.hero.slides.push(slide);
        return clone(slide);
    },
    updateHeroSlide: (id, patch) => {
        const slides = settings.hero.slides || [];
        const idx = slides.findIndex((s) => s.id === id);
        if (idx === -1) return null;
        const allowed = ['type', 'image', 'video', 'video_fallback', 'poster', 'duration',
                         'eyebrow', 'title', 'title_accent', 'lede', 'badge_title', 'badge_text'];
        allowed.forEach((key) => {
            if (patch[key] !== undefined) slides[idx][key] = patch[key];
        });
        if (patch.type && !['image', 'video', 'text'].includes(patch.type)) {
            slides[idx].type = 'image';
        }
        return clone(slides[idx]);
    },
    deleteHeroSlide: (id) => {
        const slides = settings.hero.slides || [];
        const idx = slides.findIndex((s) => s.id === id);
        if (idx === -1) return false;
        slides.splice(idx, 1);
        return true;
    },
    reorderHeroSlides: (order) => {
        const slides = settings.hero.slides || [];
        if (!Array.isArray(order)) return null;
        const map = new Map(slides.map((s) => [s.id, s]));
        const next = order.map((id) => map.get(id)).filter(Boolean);
        if (next.length !== slides.length) return null;
        settings.hero.slides = next;
        return clone(settings.hero.slides);
    },

    /* ---------------- Admin users ---------------- */
    listUsers: () => clone(adminUsers),
    getUser: (id) => adminUsers.find(u => u.id === id) || null,
    getUserByEmail: (email) => {
        const clean = String(email || '').trim().toLowerCase();
        return adminUsers.find(u => u.email.toLowerCase() === clean) || null;
    },
    createUser: (data) => {
        const record = {
            id: nextId('usr'),
            name: String(data.name || '').trim(),
            email: String(data.email || '').trim().toLowerCase(),
            role: data.role || 'viewer',
            status: data.status || 'invited',
            created_at: new Date().toISOString(),
            last_login: null
        };
        adminUsers.push(record);
        return clone(record);
    },
    updateUser: (id, patch) => {
        const user = adminUsers.find(u => u.id === id);
        if (!user) return null;
        ['name', 'email', 'role', 'status'].forEach((key) => {
            if (patch[key] !== undefined) user[key] = key === 'email' ? String(patch[key]).trim().toLowerCase() : patch[key];
        });
        return clone(user);
    },
    deleteUser: (id) => {
        const idx = adminUsers.findIndex(u => u.id === id);
        if (idx === -1) return false;
        adminUsers.splice(idx, 1);
        return true;
    },
    touchUserLogin: (id) => {
        const user = adminUsers.find(u => u.id === id);
        if (user) user.last_login = new Date().toISOString();
        return user ? clone(user) : null;
    },

    /* ---------------- Roles & permissions ---------------- */
    listRoles: () => clone(roles),
    permissionCatalogue: () => clone(PERMISSION_CATALOGUE),
    createRole: (data) => {
        const name = String(data.name || '').trim();
        const record = {
            id: nextId('role'),
            slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'role',
            name,
            description: String(data.description || '').trim(),
            permissions: Array.isArray(data.permissions) ? data.permissions : [],
            locked: false
        };
        roles.push(record);
        return clone(record);
    },
    updateRole: (id, patch) => {
        const role = roles.find(r => r.id === id);
        if (!role) return null;
        if (role.locked) return { ...clone(role), locked_error: true };
        ['name', 'description'].forEach((key) => {
            if (patch[key] !== undefined) role[key] = String(patch[key]);
        });
        if (Array.isArray(patch.permissions)) role.permissions = patch.permissions;
        return clone(role);
    },
    deleteRole: (id) => {
        const idx = roles.findIndex(r => r.id === id);
        if (idx === -1) return false;
        if (roles[idx].locked) return 'locked';
        const slug = roles[idx].slug;
        if (adminUsers.some(u => u.role === slug)) return 'in_use';
        roles.splice(idx, 1);
        return true;
    },

    /* ---------------- Logs ---------------- */
    recordLog,
    listLogs: (level) => {
        const all = clone(logs);
        if (!level || level === 'all') return all;
        return all.filter(l => l.level === level);
    },
    clearLogs: (level) => {
        if (!level || level === 'all') {
            logs = [];
            return 0;
        }
        const before = logs.length;
        logs = logs.filter(l => l.level !== level);
        return before - logs.length;
    },

    /* ---------------- Backups ---------------- */
    listBackups: () => clone(backups),
    createBackup: (actor) => {
        const data = snapshot();
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const entry = {
            id: 'bak-' + String(++backupSeq).padStart(3, '0'),
            filename: 'ardson-backup-' + stamp + '.json',
            created_at: new Date().toISOString(),
            created_by: actor || 'admin',
            size_kb: Math.max(1, Math.round(JSON.stringify(data).length / 1024)),
            status: 'ready',
            counts: countsOf(data)
        };
        backups.unshift(entry);
        backupPayloads.set(entry.id, data);
        recordLog('info', actor || 'admin', 'Created backup', entry.filename, `${entry.size_kb} KB`);
        return clone(entry);
    },
    getBackupPayload: (id) => backupPayloads.get(id) || null,
    deleteBackup: (id) => {
        const idx = backups.findIndex(b => b.id === id);
        if (idx === -1) return false;
        backups.splice(idx, 1);
        backupPayloads.delete(id);
        return true;
    },
    restoreBackup: (id, actor) => {
        const data = backupPayloads.get(id);
        if (!data) return null;
        settings = clone(data.settings);
        jobs = clone(data.jobs);
        seafarers = clone(data.seafarers);
        crewRequests = clone(data.crewRequests);
        contacts = clone(data.contacts);
        subscribers = clone(data.subscribers);
        adminUsers = clone(data.adminUsers);
        roles = clone(data.roles);
        insights = clone(data.insights || SEED_INSIGHTS);
        recordLog('warning', actor || 'admin', 'Restored backup', id, 'Live data replaced from snapshot');
        return clone(backups.find(b => b.id === id) || { id });
    }
};
