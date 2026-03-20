export default function PrivacyPage() {
  const effectiveDate = 'March 14, 2026'

  const sections = [
    {
      number: '1',
      title: 'Who We Are',
      content: `MoneyfestLending is a private, internal workplace micro-lending program operated by its administrators ("we," "us," or "our"). This program is exclusively available to active team members within our office and is not open to the general public. We are committed to protecting the personal information you share with us in accordance with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012 of the Philippines, and its Implementing Rules and Regulations.`
    },
    {
      number: '2',
      title: 'Information We Collect',
      content: null,
      list: [
        { label: 'Personal identification', detail: 'Full name, home address, phone number, and email address.' },
        { label: 'Employment information', detail: 'Department and years of tenure — used solely to assess eligibility.' },
        { label: 'Government-issued ID', detail: 'Front and back images of a valid government ID (e.g., SSS, PhilHealth, Passport, Driver\'s License). Collected for identity verification purposes only.' },
        { label: 'Loan and financial information', detail: 'Loan amount requested, purpose, preferred release method, and payment account details (e.g., GCash number or bank account).' },
        { label: 'Payment proof uploads', detail: 'Screenshots or receipts you submit as proof of installment payments.' },
        { label: 'Usage data', detail: 'Your access code, login timestamps, and portal activity — used for security and audit purposes only.' },
      ]
    },
    {
      number: '3',
      title: 'How We Use Your Information',
      content: 'We collect and process your personal information for the following legitimate purposes:',
      list: [
        { label: 'Loan processing', detail: 'To evaluate, approve, and manage your loan application.' },
        { label: 'Identity verification', detail: 'To confirm you are an eligible team member before releasing funds.' },
        { label: 'Communication', detail: 'To send you loan status updates, payment reminders, and access codes via email.' },
        { label: 'Payment tracking', detail: 'To record and confirm your installment payments and maintain accurate loan records.' },
        { label: 'Audit and compliance', detail: 'To maintain internal audit logs for accountability and dispute resolution.' },
        { label: 'Security', detail: 'To detect and prevent unauthorized access to your account or loan information.' },
      ]
    },
    {
      number: '4',
      title: 'Legal Basis for Processing',
      content: 'We process your personal data based on the following legal grounds under the Data Privacy Act of 2012:',
      list: [
        { label: 'Your consent', detail: 'By submitting a loan application, you expressly consent to the collection and processing of your personal information as described in this notice.' },
        { label: 'Contractual necessity', detail: 'Processing is necessary to fulfill the terms of your loan agreement with us.' },
        { label: 'Legitimate interests', detail: 'We process certain data (such as audit logs) to maintain the integrity and security of the program.' },
      ]
    },
    {
      number: '5',
      title: 'How We Store and Protect Your Data',
      content: null,
      list: [
        { label: 'Cloud storage', detail: 'Your data is stored on Supabase, a secure cloud database platform. All uploaded files (IDs, payment proofs) are stored in private, access-controlled storage buckets — they are not publicly accessible.' },
        { label: 'Access control', detail: 'Only authorized administrators can view your personal information, uploaded IDs, and payment proofs. Borrowers can only view their own data through their personal access code.' },
        { label: 'Encrypted connections', detail: 'All data transmitted between your device and our system is encrypted via HTTPS/TLS.' },
        { label: 'No third-party sharing', detail: 'We do not sell, rent, or share your personal information with any third party for marketing or commercial purposes.' },
      ]
    },
    {
      number: '6',
      title: 'Who Can Access Your Data',
      content: 'Access to your personal information is strictly limited to:',
      list: [
        { label: 'Program administrators', detail: 'John Paul Lacaron and Charlou June Ramil — solely for the purpose of processing and managing your loan.' },
        { label: 'You', detail: 'Via the Borrower Portal using your personal access code.' },
        { label: 'No one else', detail: 'Your data is never shared with external parties, other employees, or any government agency unless required by law.' },
      ]
    },
    {
      number: '7',
      title: 'Data Retention',
      content: 'We retain your personal information for as long as necessary to fulfill the purposes for which it was collected:',
      list: [
        { label: 'Active loan records', detail: 'Retained for the duration of your loan plus 2 years after full repayment, for audit and dispute resolution purposes.' },
        { label: 'Rejected applications', detail: 'Retained for 30 days after rejection, then permanently and irreversibly deleted.' },
        { label: 'Uploaded IDs', detail: 'For approved loans, uploaded IDs are retained for 2 years after full repayment alongside the loan record. For rejected applications, uploaded IDs are permanently deleted within 30 days of rejection.' },
        { label: 'Payment proofs', detail: 'Retained for 2 years after the loan is fully paid, then permanently deleted.' },
      ]
    },
    {
      number: '8',
      title: 'Your Rights Under the Data Privacy Act',
      content: 'As a data subject under RA 10173, you have the following rights:',
      list: [
        { label: 'Right to be informed', detail: 'You have the right to know what personal data we collect and how it is used — which is the purpose of this Privacy Notice.' },
        { label: 'Right to access', detail: 'You may request a copy of the personal data we hold about you at any time.' },
        { label: 'Right to rectification', detail: 'You may request correction of any inaccurate or incomplete personal information.' },
        { label: 'Right to erasure', detail: 'You may request deletion of your data, subject to our legal retention obligations.' },
        { label: 'Right to object', detail: 'You may object to the processing of your personal data in certain circumstances.' },
        { label: 'Right to data portability', detail: 'You may request a copy of your data in a structured, commonly used format.' },
        { label: 'Right to lodge a complaint', detail: 'You may file a complaint with the National Privacy Commission (NPC) at www.privacy.gov.ph if you believe your rights have been violated.' },
      ]
    },
    {
      number: '9',
      title: 'Cookies and Tracking',
      content: 'MoneyfestLending does not use third-party tracking cookies, advertising pixels, or analytics services that share your data with external platforms. We do not display advertisements. Any session data stored in your browser is used solely to maintain your login state within the Borrower Portal and is not shared with anyone.'
    },
    {
      number: '10',
      title: 'Changes to This Privacy Notice',
      content: 'We may update this Privacy Notice from time to time to reflect changes in our practices or applicable law. When we do, we will update the effective date below. We encourage you to review this notice periodically. Continued use of the MoneyfestLending platform after any changes constitutes your acceptance of the updated notice.'
    },
    {
      number: '11',
      title: 'How to Exercise Your Rights or Contact Us',
      content: 'To exercise any of your rights, raise a concern, or request deletion of your data, please contact the program administrators directly via Microsoft Teams Chat:',
      list: [
        { label: 'John Paul Lacaron', detail: 'Administrator / Developer — reachable via the Contact Us page.' },
        { label: 'Charlou June Ramil', detail: 'Administrator — reachable via the Contact Us page.' },
      ]
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0B0F1A', fontFamily: 'DM Sans, sans-serif', color: '#F0F4FF' }}>

      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#0d1226,#141B2D)', borderBottom: '1px solid rgba(99,102,241,0.2)', padding: '18px 28px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <img src="/favicon-96x96.png" alt="MoneyfestLending" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#F0F4FF' }}>
                Loan<span style={{ background: 'linear-gradient(90deg,#60a5fa,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Moneyfest</span>
              </div>
            </a>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/apply" style={{ padding: '7px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Apply</a>
            <a href="/faq" style={{ padding: '7px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#7A8AAA', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>FAQ</a>
            <a href="/portal" style={{ padding: '7px 14px', borderRadius: 9, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>My Portal</a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 28px 80px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 20, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', marginBottom: 20 }}>
            <img src="/padlock.png" alt="privacy" style={{ width: 13, height: 13, objectFit: 'contain' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Data Privacy</span>
          </div>
          <h1 style={{ fontFamily: 'Space Grotesk', fontWeight: 900, fontSize: 36, color: '#F0F4FF', margin: '0 0 12px', letterSpacing: -1 }}>Privacy Notice</h1>
          <p style={{ fontSize: 15, color: '#7A8AAA', lineHeight: 1.7, margin: '0 0 8px', maxWidth: 620 }}>
            This Privacy Notice explains how MoneyfestLending collects, uses, stores, and protects your personal information in accordance with the <strong style={{ color: '#CBD5F0' }}>Data Privacy Act of 2012 (RA 10173)</strong> of the Philippines.
          </p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 16 }}>
            <span style={{ fontSize: 12, color: '#4B5580' }}>📅 Effective date: <strong style={{ color: '#7A8AAA' }}>{effectiveDate}</strong></span>
            <span style={{ fontSize: 12, color: '#4B5580' }}>🔄 Last updated: <strong style={{ color: '#7A8AAA' }}>{effectiveDate}</strong></span>
          </div>
        </div>

        {/* Notice box */}
        <div style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: '16px 20px', marginBottom: 40, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <img src="/verified.png" alt="verified" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#86EFAC', lineHeight: 1.7 }}>
            <strong>Your privacy matters to us.</strong> By submitting a loan application, you acknowledge that you have read and understood this Privacy Notice and you consent to the collection and processing of your personal data as described herein.
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {sections.map((sec, i) => (
            <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 32, marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 13, color: '#818CF8' }}>
                  {sec.number}
                </div>
                <h2 style={{ fontFamily: 'Space Grotesk', fontWeight: 800, fontSize: 18, color: '#F0F4FF', margin: 0, paddingTop: 4 }}>{sec.title}</h2>
              </div>
              {sec.content && (
                <p style={{ fontSize: 14, color: '#8892B0', lineHeight: 1.85, margin: sec.list ? '0 0 16px 48px' : '0 0 0 48px' }}>
                  {sec.content}
                </p>
              )}
              {sec.list && (
                <div style={{ marginLeft: 48, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {sec.list.map((item, j) => (
                    <div key={j} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366F1', flexShrink: 0, marginTop: 6 }} />
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#CBD5F0' }}>{item.label}: </span>
                        <span style={{ fontSize: 13, color: '#8892B0', lineHeight: 1.7 }}>{item.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: '20px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: '#7A8AAA', lineHeight: 1.8 }}>
            This Privacy Notice is issued in compliance with <strong style={{ color: '#CBD5F0' }}>Republic Act No. 10173 (Data Privacy Act of 2012)</strong> and its Implementing Rules and Regulations. For complaints or inquiries, you may also contact the <strong style={{ color: '#CBD5F0' }}>National Privacy Commission</strong> at{' '}
            <a href="https://www.privacy.gov.ph" target="_blank" rel="noreferrer" style={{ color: '#60A5FA', textDecoration: 'none' }}>www.privacy.gov.ph</a>.
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/apply" style={{ fontSize: 13, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>← Back to Application</a>
            <span style={{ color: '#4B5580' }}>·</span>
            <a href="/faq" style={{ fontSize: 13, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>View FAQ</a>
            <span style={{ color: '#4B5580' }}>·</span>
            <a href="/terms" style={{ fontSize: 13, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>Terms & Conditions</a>
            <span style={{ color: '#4B5580' }}>·</span>
            <a href="/portal" style={{ fontSize: 13, color: '#60A5FA', textDecoration: 'none', fontWeight: 600 }}>My Portal</a>
          </div>
        </div>

      </div>
    </div>
  )
}
