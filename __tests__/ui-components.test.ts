/**
 * UI-017: shadcn/ui Setup
 * Test that shadcn/ui components are installed and can be imported
 */

import { describe, it, expect } from 'vitest';

describe('shadcn/ui components', () => {
  it('should import Button component', async () => {
    const { Button } = await import('@/components/ui/button');
    expect(Button).toBeDefined();
  });

  it('should import Input component', async () => {
    const { Input } = await import('@/components/ui/input');
    expect(Input).toBeDefined();
  });

  it('should import Card components', async () => {
    const {
      Card,
      CardHeader,
      CardTitle,
      CardDescription,
      CardContent,
      CardFooter,
    } = await import('@/components/ui/card');

    expect(Card).toBeDefined();
    expect(CardHeader).toBeDefined();
    expect(CardTitle).toBeDefined();
    expect(CardDescription).toBeDefined();
    expect(CardContent).toBeDefined();
    expect(CardFooter).toBeDefined();
  });

  it('should import Dialog components', async () => {
    const {
      Dialog,
      DialogTrigger,
      DialogContent,
      DialogHeader,
      DialogTitle,
      DialogDescription,
      DialogFooter,
    } = await import('@/components/ui/dialog');

    expect(Dialog).toBeDefined();
    expect(DialogTrigger).toBeDefined();
    expect(DialogContent).toBeDefined();
    expect(DialogHeader).toBeDefined();
    expect(DialogTitle).toBeDefined();
    expect(DialogDescription).toBeDefined();
    expect(DialogFooter).toBeDefined();
  });

  it('should import Label component', async () => {
    const { Label } = await import('@/components/ui/label');
    expect(Label).toBeDefined();
  });

  it('should import Select components', async () => {
    const {
      Select,
      SelectTrigger,
      SelectValue,
      SelectContent,
      SelectItem,
    } = await import('@/components/ui/select');

    expect(Select).toBeDefined();
    expect(SelectTrigger).toBeDefined();
    expect(SelectValue).toBeDefined();
    expect(SelectContent).toBeDefined();
    expect(SelectItem).toBeDefined();
  });

  it('should import Textarea component', async () => {
    const { Textarea } = await import('@/components/ui/textarea');
    expect(Textarea).toBeDefined();
  });

  it('should import Badge component', async () => {
    const { Badge } = await import('@/components/ui/badge');
    expect(Badge).toBeDefined();
  });

  it('should import Progress component', async () => {
    const { Progress } = await import('@/components/ui/progress');
    expect(Progress).toBeDefined();
  });

  it('should import Separator component', async () => {
    const { Separator } = await import('@/components/ui/separator');
    expect(Separator).toBeDefined();
  });
});
