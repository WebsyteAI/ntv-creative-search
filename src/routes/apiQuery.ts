import { handleRawEndpoint } from './raw';

// This simply re-exports the raw handler for the new path
export const handleApiQueryEndpoint = handleRawEndpoint;
