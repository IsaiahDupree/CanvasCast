/**
 * Job Failed Email Template
 *
 * Sent to users when their video job has failed.
 * Includes error information and credits refund message.
 *
 * PRD: docs/prds/11-email-notifications.md
 * Feature: EMAIL-005
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

export interface JobFailedEmailProps {
  name: string;
  title: string;
  errorMessage: string;
  creditsRefunded: number;
  supportUrl: string;
  dashboardUrl: string;
}

export const JobFailedEmail = ({
  name = '',
  title = 'Your Video',
  errorMessage = 'An unexpected error occurred',
  creditsRefunded = 1,
  supportUrl = 'https://canvascast.ai/support',
  dashboardUrl = 'https://canvascast.ai/app',
}: JobFailedEmailProps) => {
  const displayName = name?.trim() || 'there';
  const previewText = `Your video "${title}" encountered an error`;

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
            <Heading style={h1}>Video Generation Failed</Heading>

            <Text style={text}>Hi {displayName},</Text>

            <Text style={text}>
              We encountered an issue while processing your video <strong>"{title}"</strong>.
            </Text>

            {/* Error Section */}
            <Section style={errorBox}>
              <Text style={errorLabel}>
                <strong>Error Details:</strong>
              </Text>
              <Text style={errorText}>{errorMessage}</Text>
            </Section>

            {/* Credits Refund Section */}
            <Section style={refundBox}>
              <Text style={refundText}>
                <strong>Credits Refunded:</strong> {creditsRefunded}
              </Text>
              <Text style={refundSubtext}>
                Your credits have been automatically returned to your account.
              </Text>
            </Section>

            {/* Next Steps Section */}
            <Section style={nextStepsBox}>
              <Text style={h2}>
                <strong>What's Next?</strong>
              </Text>

              <ul style={unorderedList}>
                <li style={listItem}>
                  Try creating your video again with a different prompt or settings
                </li>
                <li style={listItem}>
                  Check our status page to see if we're experiencing any issues
                </li>
                <li style={listItem}>
                  Contact our support team if the problem persists
                </li>
              </ul>
            </Section>

            {/* CTA Buttons */}
            <Section style={buttonContainer}>
              <Button href={dashboardUrl} style={button}>
                Go to Dashboard
              </Button>
            </Section>

            <Section style={buttonContainer}>
              <Button href={supportUrl} style={secondaryButton}>
                Contact Support
              </Button>
            </Section>
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

export default JobFailedEmail;

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

const h2 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '24px 0 16px',
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '16px 0',
};

const errorBox = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const errorLabel = {
  color: '#991b1b',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1.5',
  margin: '0 0 8px 0',
};

const errorText = {
  color: '#b91c1c',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
  fontFamily: 'monospace',
};

const refundBox = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const refundText = {
  color: '#065f46',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 8px 0',
};

const refundSubtext = {
  color: '#047857',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
};

const nextStepsBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const unorderedList = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.75',
  margin: '12px 0',
  paddingLeft: '20px',
};

const listItem = {
  margin: '8px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '16px 0',
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

const secondaryButton = {
  backgroundColor: '#ffffff',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  color: '#374151',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
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
