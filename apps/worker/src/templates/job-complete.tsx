/**
 * Job Complete Email Template
 *
 * Sent to users when their video has finished rendering successfully.
 * Includes download link, video stats, and link to dashboard.
 *
 * PRD: docs/prds/11-email-notifications.md
 * Feature: EMAIL-004
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

export interface JobCompleteEmailProps {
  name: string;
  title: string;
  duration: string;
  credits: number;
  downloadUrl: string;
  dashboardUrl: string;
}

export const JobCompleteEmail = ({
  name = '',
  title = 'Your Video',
  duration = '',
  credits = 1,
  downloadUrl = 'https://canvascast.ai/app',
  dashboardUrl = 'https://canvascast.ai/app',
}: JobCompleteEmailProps) => {
  const displayName = name?.trim() || 'there';
  const previewText = `Your video "${title}" is ready!`;

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
            <Heading style={h1}>Your Video is Ready</Heading>

            <Text style={text}>Hi {displayName},</Text>

            <Text style={text}>
              Great news! Your video <strong>"{title}"</strong> has finished rendering.
            </Text>

            {/* Stats Section */}
            <Section style={statsBox}>
              <Text style={statsText}>
                <strong>Duration:</strong> {duration}
              </Text>
              <Text style={statsText}>
                <strong>Credits used:</strong> {credits}
              </Text>
            </Section>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button href={downloadUrl} style={button}>
                Download Your Video
              </Button>
            </Section>

            <Text style={text}>
              Or view it in your <Link href={dashboardUrl} style={link}>dashboard</Link>.
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

export default JobCompleteEmail;

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

const statsBox = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 0',
};

const statsText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
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
