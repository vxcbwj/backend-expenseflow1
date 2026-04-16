// backend/src/utils/emailTemplates.js

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const APP_NAME = process.env.APP_NAME || 'ExpenseFlow';

const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  text: '#1F2937',
  textLight: '#6B7280',
  border: '#E5E7EB',
  background: '#F9FAFB'
};

// Helper functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'DZD'
  }).format(amount);
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatPercentage = (value) => {
  return `${Math.round(value)}%`;
};

// Base email wrapper
const emailWrapper = (content, title) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          line-height: 1.6;
          color: ${COLORS.text};
          margin: 0;
          padding: 0;
          background-color: ${COLORS.background};
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
        }
        .header {
          background: linear-gradient(135deg, ${COLORS.primary} 0%, #2563EB 100%);
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          color: #ffffff;
          margin: 0;
          font-size: 24px;
        }
        .content {
          padding: 40px 30px;
        }
        .button {
          display: inline-block;
          background-color: ${COLORS.primary};
          color: #ffffff;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: 600;
        }
        .footer {
          background-color: ${COLORS.background};
          padding: 20px 30px;
          text-align: center;
          color: ${COLORS.textLight};
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        td {
          padding: 12px;
          border-bottom: 1px solid ${COLORS.border};
        }
        .label {
          font-weight: 600;
          color: ${COLORS.textLight};
        }
        @media only screen and (max-width: 480px) {
          .content {
            padding: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${APP_NAME}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          <p>You're receiving this email because you're a member of ${APP_NAME}.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Expense Approved Email
export const expenseApprovedEmail = (expense, approver) => {
  const content = `
    <div style="background-color: ${COLORS.success}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 20px;">✅ Expense Approved</h2>
    </div>
    
    <p>Good news! Your expense has been approved by <strong>${approver.firstName} ${approver.lastName}</strong>.</p>
    
    <table>
      <tr>
        <td class="label">Amount</td>
        <td><strong>${formatCurrency(expense.amount)}</strong></td>
      </tr>
      <tr>
        <td class="label">Category</td>
        <td>${expense.category}</td>
      </tr>
      <tr>
        <td class="label">Description</td>
        <td>${expense.description}</td>
      </tr>
      <tr>
        <td class="label">Date</td>
        <td>${formatDate(expense.date)}</td>
      </tr>
    </table>
    
    <center>
      <a href="${FRONTEND_URL}/expenses" class="button">View Expenses</a>
    </center>
  `;
  
  return {
    subject: `✅ Expense Approved - ${expense.description}`,
    html: emailWrapper(content, 'Expense Approved')
  };
};

// Expense Rejected Email
export const expenseRejectedEmail = (expense, reason) => {
  const content = `
    <div style="background-color: ${COLORS.danger}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 20px;">❌ Expense Rejected</h2>
    </div>
    
    <p>Your expense has been rejected and will not be reimbursed.</p>
    
    ${reason ? `
      <div style="background-color: #FEF3C7; border-left: 4px solid ${COLORS.warning}; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-weight: 600;">Rejection Reason:</p>
        <p style="margin: 5px 0 0 0;">${reason}</p>
      </div>
    ` : ''}
    
    <table>
      <tr>
        <td class="label">Amount</td>
        <td><strong>${formatCurrency(expense.amount)}</strong></td>
      </tr>
      <tr>
        <td class="label">Category</td>
        <td>${expense.category}</td>
      </tr>
      <tr>
        <td class="label">Description</td>
        <td>${expense.description}</td>
      </tr>
    </table>
    
    <center>
      <a href="${FRONTEND_URL}/expenses" class="button" style="background-color: ${COLORS.danger};">Review Expense</a>
    </center>
  `;
  
  return {
    subject: `❌ Expense Rejected - ${expense.description}`,
    html: emailWrapper(content, 'Expense Rejected')
  };
};

// Budget Alert Email
export const budgetAlertEmail = (budget, percentage, type) => {
  const isExceeded = type === 'exceeded';
  const color = isExceeded ? COLORS.danger : COLORS.warning;
  const icon = isExceeded ? '🚨' : '⚠️';
  const title = isExceeded ? 'Budget Exceeded' : 'Budget Warning';
  
  const content = `
    <div style="background-color: ${color}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 20px;">${icon} ${title}</h2>
    </div>
    
    <p>Your <strong>${budget.category}</strong> budget has reached <strong>${formatPercentage(percentage)}</strong> of its limit.</p>
    
    <div style="background-color: ${COLORS.background}; border-radius: 8px; padding: 4px; margin: 20px 0;">
      <div style="background-color: ${color}; height: 30px; border-radius: 4px; width: ${Math.min(percentage, 100)}%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
        ${formatPercentage(percentage)}
      </div>
    </div>
    
    <table>
      <tr>
        <td class="label">Budget Limit</td>
        <td><strong>${formatCurrency(budget.amount)}</strong></td>
      </tr>
      <tr>
        <td class="label">Current Spending</td>
        <td><strong>${formatCurrency(budget.currentSpending)}</strong></td>
      </tr>
      <tr>
        <td class="label">Remaining</td>
        <td style="color: ${isExceeded ? COLORS.danger : COLORS.success};">
          <strong>${formatCurrency(Math.max(0, budget.amount - budget.currentSpending))}</strong>
        </td>
      </tr>
    </table>
    
    <center>
      <a href="${FRONTEND_URL}/budgets" class="button" style="background-color: ${color};">View Budget Details</a>
    </center>
  `;
  
  return {
    subject: `${icon} ${title} - ${budget.category} (${formatPercentage(percentage)})`,
    html: emailWrapper(content, title)
  };
};

// Invitation Email
export const invitationEmail = (invitation, companyName) => {
  const content = `
    <div style="background: linear-gradient(135deg, ${COLORS.primary} 0%, #7C3AED 100%); color: white; padding: 30px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
      <h2 style="margin: 0; font-size: 24px;">📧 You're Invited!</h2>
    </div>
    
    <p>Hello!</p>
    
    <p><strong>${invitation.inviterName}</strong> has invited you to join <strong>${companyName}</strong> on ${APP_NAME}.</p>
    
    <div style="background-color: ${COLORS.background}; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: ${COLORS.primary};">What is ${APP_NAME}?</h3>
      <p style="margin-bottom: 0;">A modern expense management platform that helps teams track, approve, and manage expenses efficiently.</p>
    </div>
    
    <center>
      <a href="${FRONTEND_URL}/register?token=${invitation.token}" class="button" style="font-size: 16px; padding: 16px 32px;">Accept Invitation</a>
    </center>
    
    <p style="color: ${COLORS.textLight}; font-size: 14px; margin-top: 30px;">
      <strong>Note:</strong> This invitation expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
    </p>
  `;
  
  return {
    subject: `📧 You're invited to join ${companyName} on ${APP_NAME}`,
    html: emailWrapper(content, 'Invitation')
  };
};

// Weekly Digest Email
export const weeklyDigestEmail = (user, stats) => {
  const content = `
    <h2>Hi ${user.firstName},</h2>
    
    <p style="color: ${COLORS.textLight};">Here's your expense summary for the week of <strong>${formatDate(stats.weekStart)}</strong> to <strong>${formatDate(stats.weekEnd)}</strong>.</p>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0;">
      <div style="background-color: ${COLORS.background}; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: ${COLORS.primary};">${formatCurrency(stats.totalSpent)}</div>
        <div style="color: ${COLORS.textLight}; font-size: 14px; margin-top: 5px;">Total Spent</div>
      </div>
      
      <div style="background-color: ${COLORS.background}; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: ${COLORS.primary};">${stats.expenseCount}</div>
        <div style="color: ${COLORS.textLight}; font-size: 14px; margin-top: 5px;">Expenses</div>
      </div>
      
      <div style="background-color: ${COLORS.background}; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 20px; font-weight: 700; color: ${COLORS.primary};">${stats.topCategory}</div>
        <div style="color: ${COLORS.textLight}; font-size: 14px; margin-top: 5px;">Top Category</div>
      </div>
      
      <div style="background-color: ${COLORS.background}; padding: 20px; border-radius: 8px; text-align: center;">
        <div style="font-size: 32px; font-weight: 700; color: ${stats.pendingCount > 0 ? COLORS.warning : COLORS.success};">${stats.pendingCount}</div>
        <div style="color: ${COLORS.textLight}; font-size: 14px; margin-top: 5px;">Pending Approval</div>
      </div>
    </div>
    
    <center>
      <a href="${FRONTEND_URL}/analytics" class="button">View Full Report</a>
    </center>
  `;
  
  return {
    subject: `📊 Your Weekly Expense Summary - ${formatDate(stats.weekEnd)}`,
    html: emailWrapper(content, 'Weekly Summary')
  };
};