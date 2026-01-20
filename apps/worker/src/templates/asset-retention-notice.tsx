/**
 * Asset Retention Notice Email Template
 *
 * Sent to users before their old assets are deleted due to retention policy.
 * Gives users advance notice to download assets they want to keep.
 *
 * Feature: GDPR-001
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

export interface AssetRetentionNoticeEmailProps {
  name: string;
  assetCount: number;
  retentionDays: number;
  daysUntilDeletion: number;
  dashboardUrl: string;
}

export const AssetRetentionNoticeEmail = ({
  name = '',
  assetCount = 1,
  retentionDays = 90,
  daysUntilDeletion = 7,
  dashboardUrl = 'https://canvascast.ai/app',
}: AssetRetentionNoticeEmailProps) => {
  const displayName = name?.trim() || 'there';
  const previewText = `Your old assets will be deleted in ${daysUntilDeletion} days`;
  const assetText = assetCount === 1 ? 'asset' : 'assets';

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
            <Heading style={h1}>Asset Retention Notice</Heading>

            <Text style={text}>Hi {displayName},</Text>

            <Text style={text}>
              This is a courtesy reminder that <strong>{assetCount} {assetText}</strong> in your
              CanvasCast account will be automatically deleted in <strong>{daysUntilDeletion} days</strong>.
            </Text>

            <Text style={text}>
              As part of our data retention policy, we automatically delete assets that are older
              than {retentionDays} days. This helps us maintain efficient storage and comply with
              GDPR privacy regulations.
            </Text>

            {/* Info Box */}
            <Section style={infoBox}>
              <Text style={infoTitle}>What's being deleted?</Text>
              <Text style={infoText}>
                • Video files<br />
                • Generated images<br />
                • Audio files<br />
                • Captions and scripts<br />
                • Other project assets
              </Text>
            </Section>

            <Text style={text}>
              <strong>Want to keep these assets?</strong> Download them from your dashboard before
              they're deleted. Your project metadata and history will remain available.
            </Text>

            {/* CTA Button */}
            <Section style={buttonContainer}>
              <Button href={dashboardUrl} style={button}>
                View My Projects
              </Button>
            </Section>

            <Text style={smallText}>
              If you have any questions about our retention policy or need assistance,
              please contact our support team.
            </Text>
          </Section>

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} CanvasCast. All rights reserved.
            </Text>
            <Text style={footerText}>
              <Link href="https://canvascast.ai/privacy" style={footerLink}>
                Privacy Policy
              </Link>
              {' · '}
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

export default AssetRetentionNoticeEmail;

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
  fontSize: '28px',
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

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '16px 0',
};

const infoBox = {
  backgroundColor: '#fef3c7',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const infoTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1.5',
  margin: '0 0 12px 0',
};

const infoText = {
  color: '#78350f',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
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
