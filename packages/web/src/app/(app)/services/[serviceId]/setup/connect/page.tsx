import type { Metadata } from 'next';
import { SetupHeader } from '../SetupHeader';
import { ConnectSteps } from './ConnectSteps';

export const metadata: Metadata = { title: 'Connect your service' };

export default function ConnectPage() {
  return (
    <>
      <SetupHeader title="Connect your service" step={3} />
      <ConnectSteps />
    </>
  );
}
