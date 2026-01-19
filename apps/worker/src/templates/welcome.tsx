/**
 * Welcome Email Template
 *
 * Sent to new users after signup with trial credit information
 * and getting started guide.
 *
 * PRD: docs/prds/11-email-notifications.md
 * Feature: EMAIL-003
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

export interface WelcomeEmailProps {
  name: string;
  trialCredits: number;
  createUrl: string;
}

export const WelcomeEmail = ({
  name = '',
  trialCredits = 10,
  createUrl = 'https://canvascast.ai/app/new',
}: WelcomeEmailProps) => {
  const displayName = name?.trim() || 'there';
  const previewText = `Welcome to CanvasCast! You have ${trialCredits} free credits to get started.`;

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
            <Heading style={h1}>Welcome to CanvasCast</Heading>

            <Text style={text}>Hi {displayName},</Text>

            <Text style={text}>
              Thanks for signing up! You have{' '}
              <strong>{trialCredits} free credits</strong> to get started.
            </Text>

            {/* Getting Started Section */}
            <Section style={gettingStarted}>
              <Text style={h2}>
                <strong>What's Next?</strong>
              </Text>

              <ol style={orderedList}>
                <li style={listItem}>Enter your video idea</li>
                <li style={listItem}>Pick a style and voice</li>
                <li style={listItem}>Download your video in minutes</li>
              </ol>
            </Section>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button href={createUrl} style={button}>
                Create Your First Video
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

export default WelcomeEmail;

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

const gettingStarted = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const orderedList = {
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
