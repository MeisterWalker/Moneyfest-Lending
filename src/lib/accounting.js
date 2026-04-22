import { supabase } from './supabase'
import { QUICKLOAN_CONFIG } from './helpers'

/**
 * Automatically splits a loan payment into Interest Profit and Principal Return
 * and logs them in the capital_flow ledger.
 */
export const logAutomatedPayment = async (loan, amountReceived, cashLocation = 'hand') => {
  try {
    const isQuickLoan = loan.loan_type === 'quickloan'
    let interestProfit = 0
    let principalReturn = 0

    // ── BL-07 FIX: Guard against NaN from null/zero amounts ──
    if (!amountReceived || amountReceived <= 0) {
      console.error('logAutomatedPayment: invalid amountReceived', amountReceived)
      return { success: false, error: 'Invalid amount received' }
    }
    if (!loan.loan_amount || loan.loan_amount <= 0) {
      console.error('logAutomatedPayment: invalid loan_amount', loan.loan_amount)
      return { success: false, error: 'Invalid loan amount' }
    }

    if (isQuickLoan) {
      // For QuickLoans, we calculate interest based on the 1% daily rate
      // But usually, the user collects a fixed amount.
      // We assume any amount above the principal is profit.
      // In this specific system, the user is often collecting ₱3,300 for a ₱3,000 loan.
      
      const principalPart = Math.min(loan.loan_amount, amountReceived)
      const interestPart = amountReceived - principalPart
      
      interestProfit = interestPart
      principalReturn = principalPart
    } else {
      // For Regular Loans:
      // Interest is usually (Total Repayment - Principal) / Num Installments
      const totalInterest = (loan.total_repayment || 0) - (loan.loan_amount || 0)
      const numInstallments = loan.num_installments || 4
      
      // ── BL-07 FIX: Guard against division by zero/null ──
      if (!loan.installment_amount || loan.installment_amount <= 0) {
        console.error('logAutomatedPayment: invalid installment_amount', loan.installment_amount)
        return { success: false, error: 'Invalid installment amount — cannot calculate interest/principal split' }
      }

      // We calculate the specific interest portion for ONE standard installment
      const interestPerInstallment = totalInterest / numInstallments
      
      // If the amount received matches a standard installment, use the pre-calculated split
      // Otherwise (partial payment), we prorate it.
      const ratio = amountReceived / loan.installment_amount
      interestProfit = interestPerInstallment * ratio
      principalReturn = amountReceived - interestProfit
    }

    // Round to 2 decimal places
    interestProfit = Math.round(interestProfit * 100) / 100
    principalReturn = Math.round(principalReturn * 100) / 100

    const entries = []
    
    // Add Interest Profit Entry
    if (interestProfit > 0) {
      entries.push({
        entry_date: new Date().toISOString().slice(0, 10),
        type: 'CASH IN',
        category: isQuickLoan ? 'Interest Profit (QuickLoan)' : 'Interest Profit (Installment)',
        amount: interestProfit,
        notes: `Auto: Interest Profit from ${loan.borrowers?.full_name || 'Borrower'} payment`,
        cash_location: cashLocation
      })
    }

    // Add Principal Return Entry
    if (principalReturn > 0) {
      entries.push({
        entry_date: new Date().toISOString().slice(0, 10),
        type: 'CASH IN',
        category: 'Loan Principal Return',
        amount: principalReturn,
        notes: `Auto: Principal Return from ${loan.borrowers?.full_name || 'Borrower'} installment`,
        cash_location: cashLocation
      })
    }

    // ── Check if this is a Final Settlement to collect Penalties ──
    // If the payment covers the entire remaining balance, it's a settlement.
    if ((loan.remaining_balance || 0) > 0 && amountReceived >= (loan.remaining_balance || 0)) {
      const { data: penalties } = await supabase
        .from('penalty_charges')
        .select('penalty_amount')
        .eq('loan_id', loan.id);
      
      const { data: loanRecord } = await supabase
        .from('loans')
        .select('security_hold, security_hold_original')
        .eq('id', loan.id)
        .single();
      
      const holdAbsorbed = Math.max(0,
        (loanRecord?.security_hold_original || 0) - 
        (loanRecord?.security_hold || 0)
      );

      let unsettledPenalties = 0;
      if (penalties && penalties.length > 0) {
        unsettledPenalties = penalties.reduce((s, p) => s + (Number(p.penalty_amount) || 0), 0);
      }
      
      const cashPenalty = Math.max(0, unsettledPenalties - holdAbsorbed);

      if (cashPenalty > 0) {
        entries.push({
          entry_date: new Date().toISOString().slice(0, 10),
          type: 'CASH IN',
          category: 'Penalty (Collected at Settlement)',
          amount: cashPenalty,
          notes: `Auto: Unsettled Penalties collected at settlement from ${loan.borrowers?.full_name || 'Borrower'} (Loan ${loan.id})`,
          cash_location: cashLocation
        });
      }
    }

    if (entries.length > 0) {
      const { error } = await supabase.from('capital_flow').insert(entries)
      if (error) throw error
    }

    return { success: true, interestProfit, principalReturn }
  } catch (err) {
    console.error('Error in logAutomatedPayment:', err)
    return { success: false, error: err.message }
  }
}
