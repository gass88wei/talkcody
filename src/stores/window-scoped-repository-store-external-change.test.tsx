import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepositoryStoreProvider, useRepositoryStore } from './window-scoped-repository-store';

// Mock dependencies
vi.mock('@/services/repository-service', () => ({
  repositoryService: {
    invalidateCache: vi.fn(),
    readFileWithCache: vi.fn(),
    getFileNameFromPath: (path: string) => path.split('/').pop() || '',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/stores/settings-store', () => ({
  useSettingsStore: {
    getState: () => ({ language: 'en' }),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RepositoryStoreProvider>{children}</RepositoryStoreProvider>
);

describe('handleExternalFileChange', () => {
  const testFilePath = '/test/path/file.ts';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should ignore self-triggered file changes from recent saves', async () => {
    const { repositoryService } = await import('@/services/repository-service');
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open a file
    result.current.updateFileContent(testFilePath, 'initial content', false);

    // Mock writeFile to succeed
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('saved content');

    // Save the file (this should mark it as recently saved)
    await result.current.saveFile(testFilePath, 'saved content');

    // Clear the toast calls from saveFile
    vi.clearAllMocks();

    // Immediately trigger external file change (simulating file system watcher)
    await result.current.handleExternalFileChange(testFilePath);

    // Should NOT update the file or show toast because it's a self-triggered change
    expect(repositoryService.invalidateCache).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('should auto-update editor content when file has no unsaved changes', async () => {
    const { repositoryService } = await import('@/services/repository-service');
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open a file with no unsaved changes
    result.current.updateFileContent(testFilePath, 'old content', false);

    // Mock disk content to be different
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('new content from disk');

    // Wait for recent save timeout to expire
    vi.advanceTimersByTime(1100);

    // Trigger external file change
    await result.current.handleExternalFileChange(testFilePath);

    await waitFor(() => {
      const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
      expect(openFile?.content).toBe('new content from disk');
    });

    expect(repositoryService.invalidateCache).toHaveBeenCalledWith(testFilePath);
    expect(toast.info).toHaveBeenCalled();
  });

  it('should show conflict dialog when file has unsaved changes', async () => {
    const { repositoryService } = await import('@/services/repository-service');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open a file with unsaved changes
    result.current.updateFileContent(testFilePath, 'modified content', true);

    // Mock disk content to be different
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('external content');

    // Wait for recent save timeout to expire
    vi.advanceTimersByTime(1100);

    // Trigger external file change
    await result.current.handleExternalFileChange(testFilePath);

    await waitFor(() => {
      expect(result.current.pendingExternalChange).toEqual({
        filePath: testFilePath,
        diskContent: 'external content',
      });
    });

    // File content should NOT be auto-updated
    const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
    expect(openFile?.content).toBe('modified content');
  });

  it('should not update when disk content is the same as editor content', async () => {
    const { repositoryService } = await import('@/services/repository-service');
    const { toast } = await import('sonner');
    const { logger } = await import('@/lib/logger');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Open a file
    result.current.updateFileContent(testFilePath, 'same content', false);

    // Mock disk content to be the same
    vi.mocked(repositoryService.readFileWithCache).mockResolvedValue('same content');

    // Wait for recent save timeout to expire
    vi.advanceTimersByTime(1100);

    // Trigger external file change
    await result.current.handleExternalFileChange(testFilePath);

    await waitFor(() => {
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('External file content unchanged')
      );
    });

    // Should not show toast or update content
    expect(toast.info).not.toHaveBeenCalled();
  });

  it('should apply external change correctly when user chooses to load disk version', async () => {
    const { toast } = await import('sonner');

    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Set up pending external change
    result.current.updateFileContent(testFilePath, 'local content', true);
    
    // Manually set pendingExternalChange state
    const store = result.current;
    // @ts-expect-error - accessing internal state for testing
    store.getState().set({
      pendingExternalChange: {
        filePath: testFilePath,
        diskContent: 'disk content',
      },
    });

    // User chooses to load disk version
    result.current.applyExternalChange(false);

    await waitFor(() => {
      const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
      expect(openFile?.content).toBe('disk content');
      expect(openFile?.hasUnsavedChanges).toBe(false);
      expect(result.current.pendingExternalChange).toBeNull();
    });

    expect(toast.success).toHaveBeenCalled();
  });

  it('should apply external change correctly when user chooses to keep local', async () => {
    const { result } = renderHook(() => useRepositoryStore((state) => state), { wrapper });

    // Set up pending external change
    result.current.updateFileContent(testFilePath, 'local content', true);
    
    // Manually set pendingExternalChange state
    const store = result.current;
    // @ts-expect-error - accessing internal state for testing
    store.getState().set({
      pendingExternalChange: {
        filePath: testFilePath,
        diskContent: 'disk content',
      },
    });

    // User chooses to keep local changes
    result.current.applyExternalChange(true);

    await waitFor(() => {
      const openFile = result.current.openFiles.find((f) => f.path === testFilePath);
      expect(openFile?.content).toBe('local content');
      expect(openFile?.hasUnsavedChanges).toBe(true);
      expect(result.current.pendingExternalChange).toBeNull();
    });
  });
});
