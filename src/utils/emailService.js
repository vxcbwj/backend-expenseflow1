import { sendEmail, isEmailEnabled } from './email.js';
import * as emailTemplates from './emailTemplates.js';

/**
 * Send expense approved email
 */
export const sendExpenseApprovedEmail = async (expense, approver, submitter) => {
  if (!isEmailEnabled()) {
    console.warn('⚠️ Email not configured, skipping expense approval email');
    return { success: false, message: 'Email not configured' };
  }

  try {
    const emailData = emailTemplates.expenseApprovedEmail(expense, approver);

    const result = await sendEmail({
      to: submitter.email,
      subject: emailData.subject,
      html: emailData.html
    });

    if (result.success) {
      console.log(`✅ Expense approved email sent to ${submitter.email}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to send expense approved email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send expense rejected email
 */
export const sendExpenseRejectedEmail = async (expense, submitter, reason) => {
  if (!isEmailEnabled()) {
    console.warn('⚠️ Email not configured, skipping expense rejection email');
    return { success: false, message: 'Email not configured' };
  }

  try {
    const emailData = emailTemplates.expenseRejectedEmail(expense, reason);

    const result = await sendEmail({
      to: submitter.email,
      subject: emailData.subject,
      html: emailData.html
    });

    if (result.success) {
      console.log(`✅ Expense rejected email sent to ${submitter.email}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to send expense rejected email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send budget alert email to multiple recipients
 */
export const sendBudgetAlertEmail = async (budget, users, type) => {
  if (!isEmailEnabled()) {
    console.warn('⚠️ Email not configured, skipping budget alert email');
    return { success: false, message: 'Email not configured' };
  }

  try {
    const percentage = (budget.currentSpending / budget.amount) * 100;
    const emailData = emailTemplates.budgetAlertEmail(budget, percentage, type);

    // Send to all users (admins and managers)
    const emailPromises = users.map((user) =>
      sendEmail({
        to: user.email,
        subject: emailData.subject,
        html: emailData.html
      })
    );

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;

    console.log(`✅ Budget alert emails sent to ${successCount}/${users.length} recipients`);

    return { success: true, sent: successCount, total: users.length };
  } catch (error) {
    console.error('❌ Failed to send budget alert emails:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send invitation email
 */
export const sendInvitationEmail = async (email, token, inviterName, companyName) => {
  if (!isEmailEnabled()) {
    console.warn('⚠️ Email not configured, skipping invitation email');
    return { success: false, message: 'Email not configured' };
  }

  try {
    const invitation = { email, token, inviterName };
    const emailData = emailTemplates.invitationEmail(invitation, companyName);

    const result = await sendEmail({
      to: email,
      subject: emailData.subject,
      html: emailData.html
    });

    if (result.success) {
      console.log(`✅ Invitation email sent to ${email}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to send invitation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send weekly digest email
 */
export const sendWeeklyDigestEmail = async (user, stats) => {
  if (!isEmailEnabled()) {
    console.warn('⚠️ Email not configured, skipping weekly digest email');
    return { success: false, message: 'Email not configured' };
  }

  try {
    const emailData = emailTemplates.weeklyDigestEmail(user, stats);

    const result = await sendEmail({
      to: user.email,
      subject: emailData.subject,
      html: emailData.html
    });

    if (result.success) {
      console.log(`✅ Weekly digest email sent to ${user.email}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to send weekly digest email:', error);
    return { success: false, error: error.message };
  }
};
