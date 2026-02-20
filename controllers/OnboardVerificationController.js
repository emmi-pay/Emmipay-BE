const axios = require('axios');
const https = require('https');
const CINVerification = require('../Models/Onboarding/CINVerification');
const GSTVerification = require('../Models/Onboarding/GSTVerification');
const BankVerification = require('../Models/Onboarding/BankVerification');
const PANVerification = require('../Models/Onboarding/PANVerification');
const AadhaarVerification = require('../Models/Onboarding/AadhaarVerification');

const BASE_URL = 'https://secctrl.tutelar.io/api/v1';
const API_KEY = process.env.TUTELAR_API_KEY;
const SECRET_KEY = process.env.TUTELAR_SECRET_KEY;
const MAX_POLL = 5;
const POLL_WAIT = 3000;

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2',
    servername: 'secctrl.tutelar.io'
});

const getAuth = () =>
    `Basic ${Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')}`;

/* ========== CIN HELPERS ========== */
const calcYears = (d) => {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    let m = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    if (now.getDate() < date.getDate()) m--;
    return Math.round((m / 12) * 10) / 10;
};

const formatCIN = (cin, r) => ({
    cin,
    companyName: r.company_name || r.companyName || '',
    companyEmail: r.email_id || r.emailId || '',
    companyStatus: r.company_status || r.companyStatus || '',
    incorporationDate: r.date_of_incorporation || r.dateOfIncorporation || '',
    companyCategory: r.company_category || r.companyCategory || '',
    companySubcategory: r.company_subcategory || r.companySubcategory || '',
    classOfCompany: r.class_of_company || r.classOfCompany || '',
    registeredAddress: r.registered_address || r.registeredAddress || '',
    registrationNumber: r.registration_number || r.registrationNumber || '',
    authorisedCapital: r.authorised_capital || r.authorisedCapital || '',
    paidUpCapital: r.paid_up_capital || r.paidUpCapital || '',
    rocCode: r.roc_code || r.rocCode || '',
    listingStatus: r.whether_listed_or_not || r.whetherListedOrNot || '',
    lastAgmDate: r.date_of_last_agm || r.dateOfLastAgm || '',
    balanceSheetDate: r.date_of_balance_sheet || r.dateOfBalanceSheet || '',
    directors: (r.directors || []).map((d) => ({
        din: d.din || '',
        name: d.name || '',
        beginDate: d.begin_date || d.beginDate || '',
        endDate: d.end_date || d.endDate || ''
    })),
    charges: r.charges || [],
    yearsInBusiness: calcYears(r.date_of_incorporation || r.dateOfIncorporation),
    source: r.source || ''
});

const pollCIN = async (refId) => {
    for (let i = 0; i < MAX_POLL; i++) {
        await new Promise((r) => setTimeout(r, POLL_WAIT));
        try {
            const response = await axios.get(`${BASE_URL}/kyc/merchant/ind_mca`, {
                params: { reference_id: refId },
                headers: { Authorization: getAuth() },
                httpsAgent,
                timeout: 30000
            });
            if (response.data?.status === 'completed' && response.data?.result) {
                return { success: true, result: response.data.result };
            }
            if (response.data?.status === 'failed') {
                return { success: false, msg: response.data?.message || 'Failed' };
            }
        } catch (e) {
            console.error(`CIN Poll attempt ${i + 1} failed:`, e.message);
        }
    }
    return { success: false, msg: 'Verification timeout. Try again later.' };
};

/* ========== GST HELPERS ========== */
const formatGST = (gstin, r) => ({
    gstin,
    tradeName: r.trade_name || r.tradeName || '',
    legalName: r.legal_name || r.legalName || '',
    gstinStatus: r.gstin_status || r.gstinStatus || '',
    taxpayerType: r.taxpayer_type || r.taxpayerType || '',
    constitutionOfBusiness: r.constitution_of_business || r.constitutionOfBusiness || '',
    address: r.address || r.principal_place_of_business_address || '',
    dateOfRegistration: r.date_of_registration || r.dateOfRegistration || '',
    dateOfCancellation: r.date_of_cancellation || r.dateOfCancellation || null,
    natureOfPrincipalPlaceOfBusiness: Array.isArray(r.nature_of_principal_place_of_business || r.natureOfPrincipalPlaceOfBusiness)
        ? (r.nature_of_principal_place_of_business || r.natureOfPrincipalPlaceOfBusiness).join(', ')
        : (r.nature_of_principal_place_of_business || r.natureOfPrincipalPlaceOfBusiness || ''),
    lastUpdatedDate: r.last_updated_date || r.lastUpdatedDate || null
});

const pollBank = async (refId) => {
    for (let i = 0; i < MAX_POLL; i++) {
        await new Promise((r) => setTimeout(r, POLL_WAIT));
        try {
            const response = await axios.get(`${BASE_URL}/kyc/banking/ind_bank_account_pennyless`, {
                params: { reference_id: refId },
                headers: { Authorization: getAuth() },
                httpsAgent,
                timeout: 30000
            });
            console.log(`Bank Poll ${i + 1}:`, response.data?.status);

            if (response.data?.status === 'completed' && response.data?.result) {
                return { success: true, result: response.data.result };
            }
            if (response.data?.status === 'failed') {
                return { success: false, msg: response.data?.error?.message || response.data?.message || 'Failed' };
            }
        } catch (e) {
            console.error(`Bank Poll attempt ${i + 1} failed:`, e.message);
        }
    }
    return { success: false, msg: 'Bank verification timeout. Try again later.' };
};

const pollGST = async (refId) => {
    for (let i = 0; i < MAX_POLL; i++) {
        await new Promise((r) => setTimeout(r, POLL_WAIT));
        try {
            const response = await axios.get(`${BASE_URL}/kyc/merchant/ind_gst`, {
                params: { reference_id: refId },
                headers: { Authorization: getAuth() },
                httpsAgent,
                timeout: 30000
            });
            console.log(`GST Poll ${i + 1}:`, response.data?.status);

            if (response.data?.status === 'completed' && response.data?.result) {
                return { success: true, result: response.data.result };
            }
            if (response.data?.status === 'failed') {
                return { success: false, msg: response.data?.error?.message || response.data?.message || 'Failed' };
            }
        } catch (e) {
            console.error(`GST Poll attempt ${i + 1} failed:`, e.message);
        }
    }
    return { success: false, msg: 'GST verification timeout. Try again later.' };
};

const pollPAN = async (refId) => {
    for (let i = 0; i < MAX_POLL; i++) {
        await new Promise((r) => setTimeout(r, POLL_WAIT));
        try {
            const response = await axios.get(`${BASE_URL}/kyc/identity/ind_pan`, {
                params: { reference_id: refId },
                headers: { Authorization: getAuth() },
                httpsAgent,
                timeout: 30000
            });
            console.log(`PAN Poll ${i + 1}:`, response.data?.status);

            if (response.data?.status === 'completed' && response.data?.result) {
                return { success: true, result: response.data.result };
            }
            if (response.data?.status === 'failed') {
                return { success: false, msg: response.data?.error?.message || response.data?.message || 'Failed' };
            }
        } catch (e) {
            console.error(`PAN Poll attempt ${i + 1} failed:`, e.message);
        }
    }
    return { success: false, msg: 'PAN verification timeout. Try again later.' };
};

const pollAadhaar = async (refId) => {
    for (let i = 0; i < MAX_POLL; i++) {
        await new Promise((r) => setTimeout(r, POLL_WAIT));
        try {
            const response = await axios.get(`${BASE_URL}/kyc/identity/ind_aadhaar_with_otp`, {
                params: { reference_id: refId },
                headers: { Authorization: getAuth() },
                httpsAgent,
                timeout: 30000
            });
            console.log(`Aadhaar Poll ${i + 1}:`, response.data?.status);

            if (response.data?.status === 'completed' && response.data?.result) {
                return { success: true, result: response.data.result };
            }
            if (response.data?.status === 'failed') {
                return { success: false, msg: response.data?.error?.message || response.data?.result?.message || 'Failed' };
            }
        } catch (e) {
            console.error(`Aadhaar Poll attempt ${i + 1} failed:`, e.message);
        }
    }
    return { success: false, msg: 'Aadhaar verification timeout. Try again later.' };
};


/* ========== CONTROLLER ========== */
const OnboardVerificationController = {

    // CIN Verification
    getCINStatus: async (req, res) => {
        try {
            const { referenceId } = req.query;
            console.log('CIN Status req.query:', req.query);

            if (!referenceId) {
                return res.json({ success: false, message: 'Reference ID is required' });
            }

            // Check DB first
            const cached = await CINVerification.findOne({ referenceId }).lean();

            if (cached && cached.companyName) {
                console.log(`✅ CIN ${referenceId} from cache`);
                return res.json({
                    success: true,
                    fromCache: true,
                    status: 'completed',
                    data: formatCIN(cached.cin, cached)
                });
            }

            // Call API to get status
            console.log(`📞 Fetching CIN status for ${referenceId}`);
            const apiRes = await axios.get(
                `${BASE_URL}/kyc/merchant/ind_mca`,
                {
                    params: { reference_id: referenceId },
                    headers: { Authorization: getAuth() },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('CIN Status apiRes.data:', apiRes.data);

            // Handle in_progress
            if (apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') {
                return res.json({
                    success: true,
                    status: 'in_progress',
                    referenceId: referenceId,
                    message: 'Verification is still in progress. Please try again later.'
                });
            }

            // Handle failed
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Verification failed';
                return res.json({
                    success: false,
                    status: 'failed',
                    message: errorMsg
                });
            }

            // Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                const result = apiRes.data.result;
                const cin = result.cin;

                // Save to DB
                await CINVerification.findOneAndUpdate(
                    { cin },
                    {
                        cin,
                        referenceId: referenceId,
                        companyName: result.company_name || '',
                        registeredAddress: result.registered_address || '',
                        registrationNumber: result.registration_number || null,
                        classOfCompany: result.class_of_company || '',
                        companyCategory: result.company_category || '',
                        companySubcategory: result.company_subcategory || '',
                        companyStatus: result.company_status || '',
                        emailId: result.email_id || '',
                        rocCode: result.roc_code || null,
                        source: result.source || '',
                        dateOfIncorporation: result.date_of_incorporation || '',
                        dateOfBalanceSheet: result.date_of_balance_sheet || null,
                        dateOfLastAgm: result.date_of_last_agm || null,
                        authorisedCapital: result.authorised_capital || '0',
                        paidUpCapital: result.paid_up_capital || '0',
                        whetherListedOrNot: result.whether_listed_or_not || '',
                        numberOfMembers: result.number_of_members || null,
                        directors: (result.directors || []).map((d) => ({
                            din: d.din || '',
                            name: d.name || '',
                            begin_date: d.begin_date || '',
                            end_date: d.end_date || null
                        })),
                        charges: (result.charges || []).map((c) => ({
                            amount: c.amount || null,
                            asset: c.asset || '',
                            date_of_creation: c.date_of_creation || null,
                            date_of_modification: c.date_of_modification || null,
                            status: c.status || null
                        }))
                    },
                    { upsert: true, new: true }
                );

                console.log(`✅ CIN ${cin} verified & cached`);

                return res.json({
                    success: true,
                    fromCache: false,
                    status: 'completed',
                    data: formatCIN(cin, result)
                });
            }

            return res.json({
                success: false,
                message: 'Unexpected API response'
            });

        } catch (error) {
            console.error('CIN Status Error:', error.message);
            return res.json({ success: false, message: error.message || 'Failed to get status' });
        }
    },
    verifyCIN: async (req, res) => {
        try {
            const { cin } = req.body;
            console.log('CIN req.body:', req.body);

            if (!cin) {
                return res.json({ success: false, message: 'CIN is required' });
            }

            const pattern = /^([LU]{1}[0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6})$/;
            if (!pattern.test(cin.toUpperCase())) {
                return res.json({ success: false, message: 'Invalid CIN format' });
            }

            const n = cin.toUpperCase();

            // ✅ Check DB first
            const cached = await CINVerification.findOne({ cin: n }).lean();
            if (cached && cached.companyName) {
                console.log(`✅ CIN ${n} from cache`);
                return res.json({ success: true, fromCache: true, data: formatCIN(n, cached) });
            }

            // ✅ Call API if not in DB
            console.log(`📞 Calling CIN API for ${n}`);
            const apiRes = await axios.post(
                `${BASE_URL}/kyc/merchant/ind_mca`,
                { cin_number: n },
                {
                    headers: {
                        Authorization: getAuth(),
                        'Content-Type': 'application/json'
                    },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('CIN apiRes.data:', apiRes.data);
            const refId = apiRes.data?.reference_id;

            // ✅ Handle 400 - Invalid CIN
            if (apiRes.data?.code === 400 || !apiRes.data?.success) {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Invalid CIN';
                return res.json({ success: false, message: errorMsg });
            }

            // ✅ Handle failed status
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Verification failed';
                return res.json({ success: false, message: errorMsg });
            }

            let result = null;

            // ✅ Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                result = apiRes.data.result;
            }
            // ✅ Handle in_progress - Poll for result
            else if ((apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') && refId) {
                console.log(`⏳ CIN in progress, polling...`);
                const pollResult = await pollCIN(refId);

                if (!pollResult.success) {
                    // Return referenceId so user can check later
                    return res.json({
                        success: false,
                        status: 'in_progress',
                        referenceId: refId,
                        message: pollResult.msg || 'Verification still in progress. Use referenceId to check status later.'
                    });
                }
                result = pollResult.result;
            }
            else {
                throw new Error('Unexpected API response');
            }

            // ✅ Save to DB
            await CINVerification.findOneAndUpdate(
                { cin: n },
                {
                    cin: n,
                    referenceId: refId || '',
                    companyName: result.company_name || '',
                    registeredAddress: result.registered_address || '',
                    registrationNumber: result.registration_number || null,
                    classOfCompany: result.class_of_company || '',
                    companyCategory: result.company_category || '',
                    companySubcategory: result.company_subcategory || '',
                    companyStatus: result.company_status || '',
                    emailId: result.email_id || '',
                    rocCode: result.roc_code || null,
                    source: result.source || '',
                    dateOfIncorporation: result.date_of_incorporation || '',
                    dateOfBalanceSheet: result.date_of_balance_sheet || null,
                    dateOfLastAgm: result.date_of_last_agm || null,
                    authorisedCapital: result.authorised_capital || '0',
                    paidUpCapital: result.paid_up_capital || '0',
                    whetherListedOrNot: result.whether_listed_or_not || '',
                    numberOfMembers: result.number_of_members || null,
                    directors: (result.directors || []).map((d) => ({
                        din: d.din || '',
                        name: d.name || '',
                        begin_date: d.begin_date || '',
                        end_date: d.end_date || null
                    })),
                    charges: (result.charges || []).map((c) => ({
                        amount: c.amount || null,
                        asset: c.asset || '',
                        date_of_creation: c.date_of_creation || null,
                        date_of_modification: c.date_of_modification || null,
                        status: c.status || null
                    }))
                },
                { upsert: true, new: true }
            );

            console.log(`✅ CIN ${n} verified & cached`);

            return res.json({ success: true, fromCache: false, data: formatCIN(n, result) });

        } catch (error) {
            console.error('CIN Verification Error:', error.message);
            return res.json({ success: false, message: error.message || 'CIN verification failed' });
        }
    },

    // GST Verification
    getGSTStatus: async (req, res) => {
        try {
            const { referenceId } = req.query;
            console.log('GST Status req.query:', req.query);

            if (!referenceId) {
                return res.json({ success: false, message: 'Reference ID is required' });
            }

            // Check DB first
            const cached = await GSTVerification.findOne({ referenceId }).lean();

            if (cached && cached.tradeName) {
                console.log(`✅ GST ${referenceId} from cache`);
                return res.json({
                    success: true,
                    fromCache: true,
                    status: 'completed',
                    data: formatGST(cached.gstin, cached)
                });
            }

            // Call API to get status
            console.log(`📞 Fetching GST status for ${referenceId}`);
            const apiRes = await axios.get(
                `${BASE_URL}/kyc/merchant/ind_gst`,
                {
                    params: { reference_id: referenceId },
                    headers: { Authorization: getAuth() },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('GST Status apiRes.data:', apiRes.data);

            // Handle in_progress
            if (apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') {
                return res.json({
                    success: true,
                    status: 'in_progress',
                    referenceId: referenceId,
                    message: 'Verification is still in progress. Please try again later.'
                });
            }

            // Handle failed
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Verification failed';
                return res.json({
                    success: false,
                    status: 'failed',
                    message: errorMsg
                });
            }

            // Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                const result = apiRes.data.result;
                const gstin = result.gstin;

                // Save to DB
                await GSTVerification.findOneAndUpdate(
                    { gstin },
                    {
                        gstin,
                        referenceId: referenceId,
                        tradeName: result.trade_name || '',
                        legalName: result.legal_name || '',
                        gstinStatus: result.gstin_status || '',
                        taxpayerType: result.taxpayer_type || '',
                        constitutionOfBusiness: result.constitution_of_business || '',
                        address: result.address || result.principal_place_of_business_address || '',
                        dateOfRegistration: result.date_of_registration || null,
                        dateOfCancellation: result.date_of_cancellation || null,
                        natureOfPrincipalPlaceOfBusiness: Array.isArray(result.nature_of_principal_place_of_business)
                            ? result.nature_of_principal_place_of_business.join(', ')
                            : (result.nature_of_principal_place_of_business || ''),
                        lastUpdatedDate: result.last_updated_date || null,
                        primaryBusinessContact: Array.isArray(result.primary_business_contact)
                            ? result.primary_business_contact.join(', ')
                            : (result.primary_business_contact || null),
                        additionalPlacesOfBusiness: Array.isArray(result.additional_places_of_business_in_state)
                            ? result.additional_places_of_business_in_state.join(', ')
                            : (result.additional_places_of_business_in_state || null)
                    },
                    { upsert: true, new: true }
                );

                console.log(`✅ GST ${gstin} verified & cached`);

                return res.json({
                    success: true,
                    fromCache: false,
                    status: 'completed',
                    data: formatGST(gstin, result)
                });
            }

            return res.json({
                success: false,
                message: 'Unexpected API response'
            });

        } catch (error) {
            console.error('GST Status Error:', error.message);
            return res.json({ success: false, message: error.message || 'Failed to get status' });
        }
    },
    verifyGST: async (req, res) => {
        try {
            const { gst } = req.body;
            console.log('GST req.body:', req.body);

            if (!gst) {
                return res.json({ success: false, message: 'GST number is required' });
            }

            // GST format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
            const pattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
            if (!pattern.test(gst.toUpperCase())) {
                return res.json({ success: false, message: 'Invalid GST format' });
            }

            const n = gst.toUpperCase();

            // ✅ Check DB first
            const cached = await GSTVerification.findOne({ gstin: n }).lean();
            if (cached && cached.tradeName) {
                console.log(`✅ GST ${n} from cache`);
                return res.json({ success: true, fromCache: true, data: formatGST(n, cached) });
            }

            // ✅ Call API if not in DB
            console.log(`📞 Calling GST API for ${n}`);
            const apiRes = await axios.post(
                `${BASE_URL}/kyc/merchant/ind_gst`,
                { gst_number: n },
                {
                    headers: {
                        Authorization: getAuth(),
                        'Content-Type': 'application/json'
                    },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('GST apiRes.data:', apiRes.data);
            const refId = apiRes.data?.reference_id;

            // ✅ Handle 400 - Invalid GST
            if (apiRes.data?.code === 400 || !apiRes.data?.success) {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Invalid GST';
                return res.json({ success: false, message: errorMsg });
            }

            // ✅ Handle failed status
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Verification failed';
                return res.json({ success: false, message: errorMsg });
            }

            let result = null;

            // ✅ Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                result = apiRes.data.result;
            }
            // ✅ Handle in_progress - Poll for result
            else if ((apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') && refId) {
                console.log(`⏳ GST in progress, polling...`);
                const pollResult = await pollGST(refId);

                if (!pollResult.success) {
                    // Return referenceId so user can check later
                    return res.json({
                        success: false,
                        status: 'in_progress',
                        referenceId: refId,
                        message: pollResult.msg || 'Verification still in progress. Use referenceId to check status later.'
                    });
                }
                result = pollResult.result;
            }
            else {
                throw new Error('Unexpected API response');
            }

            // ✅ Save to DB
            await GSTVerification.findOneAndUpdate(
                { gstin: n },
                {
                    gstin: n,
                    referenceId: refId || '',
                    tradeName: result.trade_name || '',
                    legalName: result.legal_name || '',
                    gstinStatus: result.gstin_status || '',
                    taxpayerType: result.taxpayer_type || '',
                    constitutionOfBusiness: result.constitution_of_business || '',
                    address: result.address || result.principal_place_of_business_address || '',
                    dateOfRegistration: result.date_of_registration || null,
                    dateOfCancellation: result.date_of_cancellation || null,
                    natureOfPrincipalPlaceOfBusiness: Array.isArray(result.nature_of_principal_place_of_business)
                        ? result.nature_of_principal_place_of_business.join(', ')
                        : (result.nature_of_principal_place_of_business || ''),
                    lastUpdatedDate: result.last_updated_date || null,
                    primaryBusinessContact: Array.isArray(result.primary_business_contact)
                        ? result.primary_business_contact.join(', ')
                        : (result.primary_business_contact || null),
                    additionalPlacesOfBusiness: Array.isArray(result.additional_places_of_business_in_state)
                        ? result.additional_places_of_business_in_state.join(', ')
                        : (result.additional_places_of_business_in_state || null)
                },
                { upsert: true, new: true }
            );

            console.log(`✅ GST ${n} verified & cached`);

            return res.json({ success: true, fromCache: false, data: formatGST(n, result) });

        } catch (error) {
            console.error('GST Verification Error:', error.message);
            return res.json({ success: false, message: error.message || 'GST verification failed' });
        }
    },

    // Bank Pennyless Verification
    getBankStatus: async (req, res) => {
        try {
            const { referenceId } = req.query;
            console.log('Bank Status req.query:', req.query);

            if (!referenceId) {
                return res.json({ success: false, message: 'Reference ID is required' });
            }

            // Check DB first
            const cached = await BankVerification.findOne({ referenceId }).lean();

            if (cached && cached.nameAtBank) {
                console.log(`✅ Bank ${referenceId} from cache`);
                return res.json({
                    success: true,
                    fromCache: true,
                    status: 'completed',
                    data: {
                        accountNumber: cached.accountNumber,
                        ifscCode: cached.ifscCode,
                        accountExists: cached.accountExists,
                        nameAtBank: cached.nameAtBank,
                        message: cached.message
                    }
                });
            }

            // Call API to get status
            console.log(`📞 Fetching Bank status for ${referenceId}`);
            const apiRes = await axios.get(
                `${BASE_URL}/kyc/banking/ind_bank_account_pennyless`,
                {
                    params: { reference_id: referenceId },
                    headers: { Authorization: getAuth() },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('Bank Status apiRes.data:', apiRes.data);

            // Handle in_progress
            if (apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') {
                return res.json({
                    success: true,
                    status: 'in_progress',
                    referenceId: referenceId,
                    message: 'Verification is still in progress. Please try again later.'
                });
            }

            // Handle failed
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Verification failed';
                return res.json({
                    success: false,
                    status: 'failed',
                    message: errorMsg
                });
            }

            // Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                const result = apiRes.data.result;

                // Save to DB
                await BankVerification.findOneAndUpdate(
                    { referenceId },
                    {
                        referenceId: referenceId,
                        accountNumber: result.account_number || '',
                        ifscCode: result.ifsc_code || '',
                        accountExists: result.account_exists === true || result.account_exists === 'YES',
                        nameAtBank: result.name_at_bank || '',
                        message: result.message || ''
                    },
                    { upsert: true, new: true }
                );

                console.log(`✅ Bank ${referenceId} verified & cached`);

                return res.json({
                    success: true,
                    fromCache: false,
                    status: 'completed',
                    data: {
                        accountNumber: result.account_number,
                        ifscCode: result.ifsc_code,
                        accountExists: result.account_exists === true || result.account_exists === 'YES',
                        nameAtBank: result.name_at_bank,
                        message: result.message
                    }
                });
            }

            return res.json({
                success: false,
                message: 'Unexpected API response'
            });

        } catch (error) {
            console.error('Bank Status Error:', error.message);
            return res.json({ success: false, message: error.message || 'Failed to get status' });
        }
    },
    verifyBank: async (req, res) => {
        try {
            const { accountNumber, ifscCode } = req.body;
            console.log('Bank req.body:', req.body);

            if (!accountNumber || !ifscCode) {
                return res.json({ success: false, message: 'Account number and IFSC code are required' });
            }

            const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
            if (!ifscPattern.test(ifscCode.toUpperCase())) {
                return res.json({ success: false, message: 'Invalid IFSC format' });
            }

            const accNo = accountNumber.trim();
            const ifsc = ifscCode.toUpperCase();

            // ✅ Check DB first
            const cached = await BankVerification.findOne({ accountNumber: accNo, ifscCode: ifsc }).lean();
            if (cached && cached.nameAtBank) {
                console.log(`✅ Bank ${accNo} from cache`);
                return res.json({
                    success: true,
                    fromCache: true,
                    data: {
                        accountNumber: cached.accountNumber,
                        ifscCode: cached.ifscCode,
                        accountExists: cached.accountExists,
                        nameAtBank: cached.nameAtBank,
                        message: cached.message
                    }
                });
            }

            // ✅ Call API
            console.log(`📞 Calling Bank API for ${accNo}`);
            const apiRes = await axios.post(
                `${BASE_URL}/kyc/banking/ind_bank_account_pennyless`,
                { account_number: accNo, ifsc_code: ifsc },
                {
                    headers: {
                        Authorization: getAuth(),
                        'Content-Type': 'application/json'
                    },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('Bank apiRes.data:', apiRes.data);
            const refId = apiRes.data?.reference_id;

            // ✅ Handle 400 - Invalid input
            if (apiRes.data?.code === 400 || !apiRes.data?.success) {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Invalid input';
                return res.json({ success: false, message: errorMsg });
            }

            // ✅ Handle failed status
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Bank verification failed';
                return res.json({ success: false, message: errorMsg });
            }

            let result = null;

            // ✅ Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                result = apiRes.data.result;
            }
            // ✅ Handle in_progress - Poll for result
            else if ((apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') && refId) {
                console.log(`⏳ Bank in progress, polling...`);
                const pollResult = await pollBank(refId);

                if (!pollResult.success) {
                    return res.json({
                        success: false,
                        status: 'in_progress',
                        referenceId: refId,
                        message: pollResult.msg || 'Verification still in progress. Use referenceId to check status later.'
                    });
                }
                result = pollResult.result;
            }
            else {
                throw new Error('Unexpected API response');
            }

            // ✅ Save to DB
            await BankVerification.findOneAndUpdate(
                { accountNumber: accNo, ifscCode: ifsc },
                {
                    accountNumber: accNo,
                    ifscCode: ifsc,
                    referenceId: refId || '',
                    accountExists: result.account_exists === true || result.account_exists === 'YES',
                    nameAtBank: result.name_at_bank || '',
                    message: result.message || ''
                },
                { upsert: true, new: true }
            );

            console.log(`✅ Bank ${accNo} verified & cached`);

            return res.json({
                success: true,
                fromCache: false,
                data: {
                    accountNumber: accNo,
                    ifscCode: ifsc,
                    accountExists: result.account_exists === true || result.account_exists === 'YES',
                    nameAtBank: result.name_at_bank,
                    message: result.message
                }
            });

        } catch (error) {
            console.error('Bank Verification Error:', error.message);
            return res.json({ success: false, message: error.message || 'Bank verification failed' });
        }
    },

    // PAN Verification
    getPANStatus: async (req, res) => {
        try {
            const { referenceId } = req.query;
            console.log('PAN Status req.query:', req.query);

            if (!referenceId) {
                return res.json({ success: false, message: 'Reference ID is required' });
            }

            // Check DB first
            const cached = await PANVerification.findOne({ referenceId }).lean();

            if (cached && cached.nameOnDocument) {
                console.log(`✅ PAN ${referenceId} from cache`);
                return res.json({
                    success: true,
                    fromCache: true,
                    status: 'completed',
                    data: {
                        panNumber: cached.panNumber,
                        nameOnDocument: cached.nameOnDocument,
                        firstName: cached.firstName,
                        middleName: cached.middleName,
                        lastName: cached.lastName,
                        mobileNumber: cached.mobileNumber,
                        dateOfBirth: cached.dateOfBirth,
                        gender: cached.gender,
                        state: cached.state,
                        aadhaarSeedingStatus: cached.aadhaarSeedingStatus
                    }
                });
            }

            // Call API to get status
            console.log(`📞 Fetching PAN status for ${referenceId}`);
            const apiRes = await axios.get(
                `${BASE_URL}/kyc/identity/ind_pan`,
                {
                    params: { reference_id: referenceId },
                    headers: { Authorization: getAuth() },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('PAN Status apiRes.data:', apiRes.data);

            // Handle in_progress
            if (apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') {
                return res.json({
                    success: true,
                    status: 'in_progress',
                    referenceId: referenceId,
                    message: 'Verification is still in progress. Please try again later.'
                });
            }

            // Handle failed
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Verification failed';
                return res.json({
                    success: false,
                    status: 'failed',
                    message: errorMsg
                });
            }

            // Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                const result = apiRes.data.result;
                const panNumber = result.document_number;

                // Save to DB
                await PANVerification.findOneAndUpdate(
                    { panNumber },
                    {
                        panNumber,
                        referenceId: referenceId,
                        nameOnDocument: result.name_on_document || '',
                        firstName: result.first_name || '',
                        middleName: result.middle_name || '',
                        lastName: result.last_name || '',
                        mobileNumber: result.mobile_number || null,
                        dateOfBirth: result.date_of_birth || null,
                        gender: result.gender || null,
                        state: result.state || null,
                        source: result.source || null,
                        aadhaarSeedingStatus: result.aadhaar_seeding_status || false
                    },
                    { upsert: true, new: true }
                );

                console.log(`✅ PAN ${panNumber} verified & cached`);

                return res.json({
                    success: true,
                    fromCache: false,
                    status: 'completed',
                    data: {
                        panNumber: panNumber,
                        nameOnDocument: result.name_on_document,
                        firstName: result.first_name,
                        middleName: result.middle_name,
                        lastName: result.last_name,
                        mobileNumber: result.mobile_number,
                        dateOfBirth: result.date_of_birth,
                        gender: result.gender,
                        state: result.state,
                        aadhaarSeedingStatus: result.aadhaar_seeding_status
                    }
                });
            }

            return res.json({
                success: false,
                message: 'Unexpected API response'
            });

        } catch (error) {
            console.error('PAN Status Error:', error.message);
            return res.json({ success: false, message: error.message || 'Failed to get status' });
        }
    },
    verifyPAN: async (req, res) => {
        try {
            const { pan } = req.body;
            console.log('PAN req.body:', req.body);

            if (!pan) {
                return res.json({ success: false, message: 'PAN number is required' });
            }

            // PAN format: 5 letters + 4 digits + 1 letter
            const pattern = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!pattern.test(pan.toUpperCase())) {
                return res.json({ success: false, message: 'Invalid PAN format' });
            }

            const n = pan.toUpperCase();

            // ✅ Check DB first
            const cached = await PANVerification.findOne({ panNumber: n }).lean();
            if (cached && cached.nameOnDocument) {
                console.log(`✅ PAN ${n} from cache`);
                return res.json({
                    success: true,
                    fromCache: true,
                    data: {
                        panNumber: cached.panNumber,
                        nameOnDocument: cached.nameOnDocument,
                        firstName: cached.firstName,
                        middleName: cached.middleName,
                        lastName: cached.lastName,
                        mobileNumber: cached.mobileNumber,
                        dateOfBirth: cached.dateOfBirth,
                        gender: cached.gender,
                        state: cached.state,
                        aadhaarSeedingStatus: cached.aadhaarSeedingStatus
                    }
                });
            }

            // ✅ Call API
            console.log(`📞 Calling PAN API for ${n}`);
            const apiRes = await axios.post(
                `${BASE_URL}/kyc/identity/ind_pan`,
                { pan_number: n },
                {
                    headers: {
                        Authorization: getAuth(),
                        'Content-Type': 'application/json'
                    },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('PAN apiRes.data:', apiRes.data);
            const refId = apiRes.data?.reference_id;

            // ✅ Handle 400 - Invalid PAN
            if (apiRes.data?.code === 400 || !apiRes.data?.success) {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Invalid PAN';
                return res.json({ success: false, message: errorMsg });
            }

            // ✅ Handle failed status
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'PAN verification failed';
                return res.json({ success: false, message: errorMsg });
            }

            let result = null;

            // ✅ Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                result = apiRes.data.result;
            }
            // ✅ Handle in_progress - Poll for result
            else if ((apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') && refId) {
                console.log(`⏳ PAN in progress, polling...`);
                const pollResult = await pollPAN(refId);

                if (!pollResult.success) {
                    return res.json({
                        success: false,
                        status: 'in_progress',
                        referenceId: refId,
                        message: pollResult.msg || 'Verification still in progress. Use referenceId to check status later.'
                    });
                }
                result = pollResult.result;
            }
            else {
                throw new Error('Unexpected API response');
            }

            // ✅ Save to DB
            await PANVerification.findOneAndUpdate(
                { panNumber: n },
                {
                    panNumber: n,
                    referenceId: refId || '',
                    nameOnDocument: result.name_on_document || '',
                    firstName: result.first_name || '',
                    middleName: result.middle_name || '',
                    lastName: result.last_name || '',
                    mobileNumber: result.mobile_number || null,
                    dateOfBirth: result.date_of_birth || null,
                    gender: result.gender || null,
                    state: result.state || null,
                    source: result.source || null,
                    aadhaarSeedingStatus: result.aadhaar_seeding_status || false
                },
                { upsert: true, new: true }
            );

            console.log(`✅ PAN ${n} verified & cached`);

            return res.json({
                success: true,
                fromCache: false,
                data: {
                    panNumber: n,
                    nameOnDocument: result.name_on_document,
                    firstName: result.first_name,
                    middleName: result.middle_name,
                    lastName: result.last_name,
                    mobileNumber: result.mobile_number,
                    dateOfBirth: result.date_of_birth,
                    gender: result.gender,
                    state: result.state,
                    aadhaarSeedingStatus: result.aadhaar_seeding_status
                }
            });

        } catch (error) {
            console.error('PAN Verification Error:', error.message);
            return res.json({ success: false, message: error.message || 'PAN verification failed' });
        }
    },

    // Step 1: Send Aadhaar OTP
    sendAadhaarOTP: async (req, res) => {
        try {
            const { aadhaarNumber } = req.body;
            console.log('Aadhaar OTP req.body:', req.body);

            if (!aadhaarNumber) {
                return res.json({ success: false, message: 'Aadhaar number is required' });
            }

            const pattern = /^[0-9]{12}$/;
            if (!pattern.test(aadhaarNumber)) {
                return res.json({ success: false, message: 'Invalid Aadhaar format. Must be 12 digits.' });
            }

            // Check if already verified
            const existing = await AadhaarVerification.findOne({
                aadhaarNumber,
                status: 'completed'
            }).lean();

            if (existing) {
                console.log(`✅ Aadhaar ${aadhaarNumber} already verified`);
                return res.json({
                    success: true,
                    fromCache: true,
                    data: {
                        aadhaarNumber: existing.aadhaarNumber,
                        nameOnDocument: existing.nameOnDocument,
                        gender: existing.gender,
                        dateOfBirth: existing.dateOfBirth,
                        address: existing.address,
                        city: existing.city,
                        pinCode: existing.pinCode,
                        district: existing.district,
                        state: existing.state,
                        country: existing.country
                    }
                });
            }

            console.log(`📞 Sending Aadhaar OTP for ${aadhaarNumber}`);

            // ✅ NO x-consumer-username for Send OTP
            const apiRes = await axios.post(
                `${BASE_URL}/kyc/identity/ind_aadhaar_with_otp`,
                { aadhaar_number: aadhaarNumber },
                {
                    headers: {
                        Authorization: getAuth(),
                        'Content-Type': 'application/json'
                    },
                    httpsAgent,
                    timeout: 30000
                }
            );

            console.log('Aadhaar OTP apiRes.data:', apiRes.data);

            if (!apiRes.data?.success) {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.message || 'Failed to send OTP';
                return res.json({ success: false, message: errorMsg });
            }

            const refId = apiRes.data?.reference_id;

            await AadhaarVerification.findOneAndUpdate(
                { aadhaarNumber },
                {
                    aadhaarNumber,
                    referenceId: refId,
                    status: 'otp_sent'
                },
                { upsert: true, new: true }
            );

            console.log(`✅ Aadhaar OTP sent for ${aadhaarNumber}`);

            return res.json({
                success: true,
                message: 'OTP sent successfully',
                referenceId: refId
            });

        } catch (error) {
            console.error('Aadhaar OTP Error:', error.response?.data || error.message);
            return res.json({ success: false, message: error.response?.data?.message || 'Failed to send OTP' });
        }
    },

    // Step 2: Verify Aadhaar OTP
    verifyAadhaarOTP: async (req, res) => {
        try {
            const { referenceId, otp } = req.body;
            console.log('Aadhaar Verify OTP req.body:', req.body);

            if (!referenceId || !otp) {
                return res.json({ success: false, message: 'Reference ID and OTP are required' });
            }

            // Verify OTP
            console.log(`📞 Verifying Aadhaar OTP for ${referenceId}`);

            let apiRes;
            try {
                apiRes = await axios.post(
                    `${BASE_URL}/kyc/verify/aadhaar/otp`,
                    { reference_id: referenceId, otp: otp },
                    {
                        headers: {
                            Authorization: getAuth(),
                            'Content-Type': 'application/json'
                        },
                        httpsAgent,
                        timeout: 30000
                    }
                );
            } catch (axiosError) {
                console.error('Aadhaar Verify API Error:', axiosError.response?.status, axiosError.response?.data);
                const errorMsg = axiosError.response?.data?.message || axiosError.response?.data?.error?.message || 'OTP verification failed';
                return res.json({ success: false, message: errorMsg });
            }

            console.log('Aadhaar Verify OTP apiRes.data:', apiRes.data);

            if (!apiRes.data?.success) {
                const errorMsg = apiRes.data?.message || apiRes.data?.error?.message || 'OTP verification failed';
                return res.json({ success: false, message: errorMsg });
            }

            // Poll for result
            console.log(`⏳ Polling for Aadhaar result...`);
            const pollResult = await pollAadhaar(referenceId);

            if (!pollResult.success) {
                // Update status to failed
                await AadhaarVerification.findOneAndUpdate(
                    { referenceId },
                    { status: 'failed', errorMessage: pollResult.msg }
                );
                return res.json({ success: false, message: pollResult.msg });
            }

            const result = pollResult.result;

            // Check if verification failed due to consent
            if (result.message && result.message.includes('consent')) {
                await AadhaarVerification.findOneAndUpdate(
                    { referenceId },
                    { status: 'failed', errorMessage: result.message }
                );
                return res.json({ success: false, message: result.message });
            }

            // Update with verified data
            await AadhaarVerification.findOneAndUpdate(
                { referenceId },
                {
                    status: 'completed',
                    nameOnDocument: result.name_on_document || '',
                    gender: result.gender || '',
                    dateOfBirth: result.date_of_birth || null,
                    mobileNumber: result.mobile_number || '',
                    address: result.address || '',
                    city: result.city || '',
                    pinCode: result.pin_code || '',
                    district: result.district || '',
                    state: result.state || '',
                    country: result.country || '',
                    landmark: result.land_mark || '',
                    photo: result.photo || '',
                    downloadUrl: result.download_url || '',
                    shareCode: result.share_code || ''
                }
            );

            console.log(`✅ Aadhaar verified for ${referenceId}`);

            return res.json({
                success: true,
                fromCache: false,
                data: {
                    nameOnDocument: result.name_on_document,
                    gender: result.gender,
                    dateOfBirth: result.date_of_birth,
                    mobileNumber: result.mobile_number,
                    address: result.address,
                    city: result.city,
                    pinCode: result.pin_code,
                    district: result.district,
                    state: result.state,
                    country: result.country,
                    landmark: result.land_mark,
                    photo: result.photo,
                    downloadUrl: result.download_url
                }
            });

        } catch (error) {
            console.error('Aadhaar Verify OTP Error:', error.message);
            return res.json({ success: false, message: error.message || 'OTP verification failed' });
        }
    },

    // Get Aadhaar Status by Reference ID
    getAadhaarStatus: async (req, res) => {
        try {
            const { referenceId } = req.query;
            console.log('Aadhaar Status req.query:', req.query);

            if (!referenceId) {
                return res.json({ success: false, message: 'Reference ID is required' });
            }

            // Check DB first
            const cached = await AadhaarVerification.findOne({ referenceId }).lean();

            if (cached && cached.status === 'completed') {
                console.log(`✅ Aadhaar ${referenceId} from cache`);
                return res.json({
                    success: true,
                    fromCache: true,
                    status: 'completed',
                    data: {
                        aadhaarNumber: cached.aadhaarNumber,
                        nameOnDocument: cached.nameOnDocument,
                        gender: cached.gender,
                        dateOfBirth: cached.dateOfBirth,
                        mobileNumber: cached.mobileNumber,
                        address: cached.address,
                        city: cached.city,
                        pinCode: cached.pinCode,
                        district: cached.district,
                        state: cached.state,
                        country: cached.country,
                        landmark: cached.landmark,
                        photo: cached.photo,
                        downloadUrl: cached.downloadUrl
                    }
                });
            }

            // Call API to get status
            console.log(`📞 Fetching Aadhaar status for ${referenceId}`);

            let apiRes;
            try {
                apiRes = await axios.get(
                    `${BASE_URL}/kyc/identity/ind_aadhaar_with_otp`,
                    {
                        params: { reference_id: referenceId },
                        headers: { Authorization: getAuth() },
                        httpsAgent,
                        timeout: 30000
                    }
                );
            } catch (axiosError) {
                console.error('Aadhaar Status API Error:', axiosError.response?.status, axiosError.response?.data);
                const errorMsg = axiosError.response?.data?.message || 'Failed to get status';
                return res.json({ success: false, message: errorMsg });
            }

            console.log('Aadhaar Status apiRes.data:', apiRes.data);

            // Handle in_progress
            if (apiRes.data?.status === 'in_progress' || apiRes.data?.status === 'inprogress') {
                return res.json({
                    success: true,
                    status: 'in_progress',
                    referenceId: referenceId,
                    message: 'Verification is still in progress. Please try again later.'
                });
            }

            // Handle failed
            if (apiRes.data?.status === 'failed') {
                const errorMsg = apiRes.data?.error?.message || apiRes.data?.result?.message || 'Verification failed';

                await AadhaarVerification.findOneAndUpdate(
                    { referenceId },
                    { status: 'failed', errorMessage: errorMsg }
                );

                return res.json({
                    success: false,
                    status: 'failed',
                    message: errorMsg
                });
            }

            // Handle completed
            if (apiRes.data?.status === 'completed' && apiRes.data?.result) {
                const result = apiRes.data.result;

                // Check consent error
                if (result.message && result.message.includes('consent')) {
                    await AadhaarVerification.findOneAndUpdate(
                        { referenceId },
                        { status: 'failed', errorMessage: result.message }
                    );
                    return res.json({ success: false, status: 'failed', message: result.message });
                }

                // Save to DB
                await AadhaarVerification.findOneAndUpdate(
                    { referenceId },
                    {
                        status: 'completed',
                        nameOnDocument: result.name_on_document || '',
                        gender: result.gender || '',
                        dateOfBirth: result.date_of_birth || null,
                        mobileNumber: result.mobile_number || '',
                        address: result.address || '',
                        city: result.city || '',
                        pinCode: result.pin_code || '',
                        district: result.district || '',
                        state: result.state || '',
                        country: result.country || '',
                        landmark: result.land_mark || '',
                        photo: result.photo || '',
                        downloadUrl: result.download_url || '',
                        shareCode: result.share_code || ''
                    }
                );

                console.log(`✅ Aadhaar ${referenceId} verified & cached`);

                return res.json({
                    success: true,
                    fromCache: false,
                    status: 'completed',
                    data: {
                        nameOnDocument: result.name_on_document,
                        gender: result.gender,
                        dateOfBirth: result.date_of_birth,
                        mobileNumber: result.mobile_number,
                        address: result.address,
                        city: result.city,
                        pinCode: result.pin_code,
                        district: result.district,
                        state: result.state,
                        country: result.country,
                        landmark: result.land_mark,
                        photo: result.photo,
                        downloadUrl: result.download_url
                    }
                });
            }

            return res.json({
                success: false,
                message: 'Unexpected API response'
            });

        } catch (error) {
            console.error('Aadhaar Status Error:', error.message);
            return res.json({ success: false, message: error.message || 'Failed to get status' });
        }
    }
};

module.exports = OnboardVerificationController;