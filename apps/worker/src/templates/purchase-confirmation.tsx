/**
 * Purchase Confirmation Email Template
 *
 * Sent to users after successfully purchasing credits via Stripe.
 * Shows credits added, amount paid, and receipt information.
 *
 * PRD: docs/prds/11-email-notifications.md
 * PRD: docs/prds/10-credits-billing.md
 * Feature: EMAIL-006
 */

import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export interface PurchaseConfirmationEmailProps {
  name: string;
  credits: number;
  amount: number;
  packName: string;
  dashboardUrl: string;
}

export const PurchaseConfirmationEmail = ({
  name = '',
  credits = 0,
  amount = 0,
  packName = 'Credit Pack',
  dashboardUrl = 'https://canvascast.ai/app',
}: PurchaseConfirmationEmailProps) => {
  const displayName = name?.trim() || 'there';
  const previewText = `Your ${credits} credits have been added to your account!`;
  const formattedAmount = `$${(amount / 100).toFixed(2)}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={header}>
            <Img
              src="https://canvascast.ai/logo.png"
              width="150"
              height="40"
              alt="CanvasCast"
              style={logo}
            />
          </Section>

          {/* Main Content */}
          <Section style={content}>
            <Heading style={h1}>Purchase Confirmed!</Heading>

            <Text style={text}>Hi {displayName},</Text>

            <Text style={text}>
              Thank you for your purchase! <strong>{credits} credits</strong> have been added to your account.
            </Text>

            {/* Receipt Section */}
            <Section style={receiptBox}>
              <Text style={receiptTitle}>
                <strong>Receipt</strong>
              </Text>
              <Hr style={receiptDivider} />
              <Text style={receiptText}>
                <strong>Package:</strong> {packName}
              </Text>
              <Text style={receiptText}>
                <strong>Credits:</strong> {credits}
              </Text>
              <Text style={receiptText}>
                <strong>Amount paid:</strong> {formattedAmount}
              </Text>
            </Section>

            <Text style={text}>
              You can start creating videos right away with your new credits!
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button href={dashboardUrl} style={button}>
                Go to Dashboard
              </Button>
            </Section>

            <Text style={footnote}>
              Questions about your purchase? <Link href="https://canvascast.ai/support" style={link}>Contact support</Link>
            </Text>
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} CanvasCast. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://canvascast.ai/unsubscribe" style={footerLink}>
                Manage email preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default PurchaseConfirmationEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const header = {
  textAlign: 'center' as const,
  padding: '20px 0',
};

const logo = {
  margin: '0 auto',
};

const content = {
  padding: '0 48px',
};

const h1 = {
  color: '#1f2937',
  fontSize: '32px',
  fontWeight: '700',
  lineHeight: '1.25',
  margin: '16px 0',
  textAlign: 'center' as const,
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '16px 0',
};

const receiptBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
  border: '1px solid #e5e7eb',
};

const receiptTitle = {
  color: '#1f2937',
  fontSize: '18px',
  fontWeight: '600',
  margin: '0 0 8px 0',
};

const receiptDivider = {
  borderColor: '#e5e7eb',
  margin: '12px 0',
};

const receiptText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '8px 0',
};

const footnote = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '24px 0 0 0',
  textAlign: 'center' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#7c3aed',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const link = {
  color: '#7c3aed',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 0',
};

const footer = {
  textAlign: 'center' as const,
  padding: '0 48px',
};

const footerText = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '1.5',
  margin: '8px 0',
};

const footerLink = {
  color: '#7c3aed',
  textDecoration: 'underline',
};
