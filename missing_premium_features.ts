# Advanced Diff Viewer (Gold Tier)
cat > src/components/diff/AdvancedDiffViewer.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert
} from 'react-native';
import { FeatureGate } from '../../billing/components/FeatureGate';
import { useFeatureAccess } from '../../billing/utils/useFeatureAccess';

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'context';
  content: string;
  lineNumber: {
    old?: number;
    new?: number;
  };
}

interface DiffFile {
  filename: string;
  oldVersion: string;
  newVersion: string;
  lines: DiffLine[];
  stats: {
    additions: number;
    deletions: number;
    changes: number;
  };
}

interface DiffViewerProps {
  files?: DiffFile[];
  onCompare?: (oldCode: string, newCode: string) => void;
}

export const AdvancedDiffViewer: React.FC<DiffViewerProps> = ({ 
  files = [], 
  onCompare 
}) => {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('unified');
  const [showWhitespace, setShowWhitespace] = useState(false);
  const [showContext, setShowContext] = useState(true);
  const [contextLines, setContextLines] = useState(3);
  
  const { hasAccess, recordUsage } = useFeatureAccess('diff_viewer');
  
  useEffect(() => {
    if (hasAccess && files.length > 0) {
      recordUsage();
    }
  }, [hasAccess, files.length]);
  
  const toggleFileSelection = (filename: string) => {
    setSelectedFiles(prev => 
      prev.includes(filename)
        ? prev.filter(f => f !== filename)
        : [...prev, filename]
    );
  };
  
  const generateDiff = (oldCode: string, newCode: string): DiffLine[] => {
    // Simple diff algorithm (in production, use a proper diff library)
    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const diff: DiffLine[] = [];
    
    let oldIndex = 0;
    let newIndex = 0;
    
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];
      
      if (oldIndex >= oldLines.length) {
        // Only new lines remaining
        diff.push({
          type: 'added',
          content: newLine,
          lineNumber: { new: newIndex + 1 }
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Only old lines remaining
        diff.push({
          type: 'removed',
          content: oldLine,
          lineNumber: { old: oldIndex + 1 }
        });
        oldIndex++;
      } else if (oldLine === newLine) {
        // Lines are the same
        diff.push({
          type: 'unchanged',
          content: oldLine,
          lineNumber: { old: oldIndex + 1, new: newIndex + 1 }
        });
        oldIndex++;
        newIndex++;
      } else {
        // Lines are different - mark as removed and added
        diff.push({
          type: 'removed',
          content: oldLine,
          lineNumber: { old: oldIndex + 1 }
        });
        diff.push({
          type: 'added',
          content: newLine,
          lineNumber: { new: newIndex + 1 }
        });
        oldIndex++;
        newIndex++;
      }
    }
    
    return diff;
  };
  
  const calculateStats = (lines: DiffLine[]) => {
    return lines.reduce(
      (stats, line) => {
        switch (line.type) {
          case 'added':
            stats.additions++;
            break;
          case 'removed':
            stats.deletions++;
            break;
          case 'unchanged':
            if (lines.some(l => l.type === 'added' || l.type === 'removed')) {
              stats.changes++;
            }
            break;
        }
        return stats;
      },
      { additions: 0, deletions: 0, changes: 0 }
    );
  };
  
  const renderDiffLine = (line: DiffLine, index: number) => {
    const showLine = showContext || line.type !== 'unchanged';
    
    if (!showLine) return null;
    
    const lineStyle = [
      styles.diffLine,
      line.type === 'added' && styles.addedLine,
      line.type === 'removed' && styles.removedLine,
      line.type === 'unchanged' && styles.unchangedLine
    ];
    
    const content = showWhitespace 
      ? line.content.replace(/ /g, '·').replace(/\t/g, '→')
      : line.content;
    
    return (
      <View key={index} style={lineStyle}>
        <View style={styles.lineNumbers}>
          <Text style={styles.lineNumber}>
            {line.lineNumber.old || ''}
          </Text>
          <Text style={styles.lineNumber}>
            {line.lineNumber.new || ''}
          </Text>
        </View>
        
        <View style={styles.linePrefix}>
          <Text style={styles.linePrefixText}>
            {line.type === 'added' ? '+' : 
             line.type === 'removed' ? '-' : ' '}
          </Text>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={styles.lineContent}>{content}</Text>
        </ScrollView>
      </View>
    );
  };
  
  const renderFileDiff = (file: DiffFile) => (
    <View key={file.filename} style={styles.fileContainer}>
      <View style={styles.fileHeader}>
        <TouchableOpacity
          style={styles.fileSelector}
          onPress={() => toggleFileSelection(file.filename)}
        >
          <Text style={styles.fileCheckbox}>
            {selectedFiles.includes(file.filename) ? '☑️' : '☐'}
          </Text>
          <Text style={styles.filename}>{file.filename}</Text>
        </TouchableOpacity>
        
        <View style={styles.fileStats}>
          <Text style={styles.statsText}>
            +{file.stats.additions} -{file.stats.deletions}
          </Text>
        </View>
      </View>
      
      <View style={styles.diffContainer}>
        {file.lines.map(renderDiffLine)}
      </View>
    </View>
  );
  
  const handleBulkOperations = () => {
    if (selectedFiles.length === 0) {
      Alert.alert('No Files Selected', 'Please select files to perform bulk operations.');
      return;
    }
    
    Alert.alert(
      'Bulk Operations',
      `Apply changes to ${selectedFiles.length} selected files?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply All', onPress: () => console.log('Applying changes to:', selectedFiles) },
        { text: 'Reject All', onPress: () => console.log('Rejecting changes to:', selectedFiles) }
      ]
    );
  };
  
  return (
    <FeatureGate feature="diff_viewer">
      <View style={styles.container}>
        <View style={styles.toolbar}>
          <Text style={styles.title}>📊 Advanced Diff Viewer</Text>
          
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'unified' && styles.activeToggle
              ]}
              onPress={() => setViewMode('unified')}
            >
              <Text style={styles.toggleText}>Unified</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.toggleButton,
                viewMode === 'side-by-side' && styles.activeToggle
              ]}
              onPress={() => setViewMode('side-by-side')}
            >
              <Text style={styles.toggleText}>Split</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.options}>
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Show Whitespace</Text>
            <Switch
              value={showWhitespace}
              onValueChange={setShowWhitespace}
              trackColor={{ false: '#767577', true: '#00D084' }}
            />
          </View>
          
          <View style={styles.optionRow}>
            <Text style={styles.optionLabel}>Show Context</Text>
            <Switch
              value={showContext}
              onValueChange={setShowContext}
              trackColor={{ false: '#767577', true: '#00D084' }}
            />
          </View>
          
          {selectedFiles.length > 0 && (
            <TouchableOpacity
              style={styles.bulkButton}
              onPress={handleBulkOperations}
            >
              <Text style={styles.bulkButtonText}>
                📝 Bulk Actions ({selectedFiles.length})
              </Text>
            </TouchableOpacity>
          )}
        </View>
        
        <ScrollView style={styles.diffView}>
          {files.length > 0 ? (
            files.map(renderFileDiff)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                📊 No diffs to display
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Compare code versions to see changes
              </Text>
              
              <TouchableOpacity
                style={styles.compareButton}
                onPress={() => {
                  // Demo diff
                  const oldCode = `def hello_world():
    print("Hello World!")
    return True

def calculate(x, y):
    return x + y`;
                  
                  const newCode = `def hello_world():
    print("Hello, World!")
    print("Welcome to ChatGPT Companion!")
    return True

def calculate(x, y, operation='add'):
    if operation == 'add':
        return x + y
    elif operation == 'subtract':
        return x - y
    else:
        return 0`;
                  
                  if (onCompare) {
                    onCompare(oldCode, newCode);
                  }
                }}
              >
                <Text style={styles.compareButtonText}>
                  🔄 Compare Demo Code
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </FeatureGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#2d2d30',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#00D084',
  },
  toggleText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  options: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  optionLabel: {
    color: '#cccccc',
    fontSize: 16,
  },
  bulkButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  bulkButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  diffView: {
    flex: 1,
  },
  fileContainer: {
    marginBottom: 16,
  },
  fileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2d2d30',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  fileSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  fileCheckbox: {
    fontSize: 16,
    marginRight: 8,
  },
  filename: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fileStats: {
    backgroundColor: '#3e3e42',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statsText: {
    color: '#00D084',
    fontSize: 12,
    fontWeight: 'bold',
  },
  diffContainer: {
    backgroundColor: '#252526',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  diffLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 20,
  },
  addedLine: {
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
  },
  removedLine: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  unchangedLine: {
    backgroundColor: 'transparent',
  },
  lineNumbers: {
    flexDirection: 'row',
    minWidth: 80,
    paddingHorizontal: 8,
  },
  lineNumber: {
    color: '#969696',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 30,
    textAlign: 'right',
  },
  linePrefix: {
    width: 20,
    alignItems: 'center',
  },
  linePrefixText: {
    color: '#969696',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  lineContent: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingRight: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#969696',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  compareButton: {
    backgroundColor: '#00D084',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  compareButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
EOF

# Scheduled Batch Prompts (Gold Tier)
cat > src/components/automation/BatchPromptScheduler.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Switch,
  Modal
} from 'react-native';
import { FeatureGate } from '../../billing/components/FeatureGate';
import { useFeatureAccess } from '../../billing/utils/useFeatureAccess';

interface BatchPrompt {
  id: string;
  name: string;
  prompts: string[];
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'monthly';
    time: string;
    days?: number[]; // For weekly
    date?: string; // For once/monthly
  };
  enabled: boolean;
  lastRun?: string;
  nextRun: string;
  results: BatchResult[];
}

interface BatchResult {
  promptIndex: number;
  prompt: string;
  response: string;
  timestamp: string;
  executionTime: number;
  success: boolean;
}

export const BatchPromptScheduler: React.FC = () => {
  const [batches, setBatches] = useState<BatchPrompt[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBatch, setNewBatch] = useState<Partial<BatchPrompt>>({
    name: '',
    prompts: [''],
    schedule: {
      type: 'daily',
      time: '09:00'
    },
    enabled: true
  });
  
  const { hasAccess, recordUsage } = useFeatureAccess('batch_prompts');
  
  useEffect(() => {
    loadSavedBatches();
  }, []);
  
  const loadSavedBatches = () => {
    // Load from secure storage
    const sampleBatches: BatchPrompt[] = [
      {
        id: '1',
        name: 'Daily Code Review',
        prompts: [
          'Review the latest commits in the main branch',
          'Check for any security vulnerabilities',
          'Suggest performance improvements',
          'Generate a summary report'
        ],
        schedule: {
          type: 'daily',
          time: '09:00'
        },
        enabled: true,
        lastRun: '2024-01-15T09:00:00Z',
        nextRun: '2024-01-16T09:00:00Z',
        results: []
      },
      {
        id: '2',
        name: 'Weekly Documentation Update',
        prompts: [
          'Scan for new functions without documentation',
          'Generate missing docstrings',
          'Update README with new features',
          'Create changelog entries'
        ],
        schedule: {
          type: 'weekly',
          time: '10:00',
          days: [1] // Monday
        },
        enabled: false,
        nextRun: '2024-01-22T10:00:00Z',
        results: []
      }
    ];
    
    setBatches(sampleBatches);
  };
  
  const createBatch = async () => {
    if (!newBatch.name || !newBatch.prompts?.length) {
      Alert.alert('Validation Error', 'Please provide a name and at least one prompt.');
      return;
    }
    
    await recordUsage();
    
    const batch: BatchPrompt = {
      id: Date.now().toString(),
      name: newBatch.name,
      prompts: newBatch.prompts.filter(p => p.trim()),
      schedule: newBatch.schedule!,
      enabled: newBatch.enabled || false,
      nextRun: calculateNextRun(newBatch.schedule!),
      results: []
    };
    
    setBatches(prev => [...prev, batch]);
    setShowCreateModal(false);
    setNewBatch({
      name: '',
      prompts: [''],
      schedule: { type: 'daily', time: '09:00' },
      enabled: true
    });
    
    Alert.alert('Success', `Batch prompt "${batch.name}" has been scheduled.`);
  };
  
  const calculateNextRun = (schedule: BatchPrompt['schedule']): string => {
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    
    switch (schedule.type) {
      case 'once':
        return schedule.date || now.toISOString();
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(hours, minutes, 0, 0);
        return tomorrow.toISOString();
      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(hours, minutes, 0, 0);
        return nextWeek.toISOString();
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setHours(hours, minutes, 0, 0);
        return nextMonth.toISOString();
      default:
        return now.toISOString();
    }
  };
  
  const toggleBatch = (id: string) => {
    setBatches(prev =>
      prev.map(batch =>
        batch.id === id
          ? { ...batch, enabled: !batch.enabled }
          : batch
      )
    );
  };
  
  const runBatchNow = async (batch: BatchPrompt) => {
    Alert.alert(
      'Run Batch Now',
      `Execute "${batch.name}" immediately?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Run Now', 
          onPress: async () => {
            await recordUsage();
            console.log('Running batch:', batch.name);
            // Simulate batch execution
            simulateBatchExecution(batch);
          }
        }
      ]
    );
  };
  
  const simulateBatchExecution = (batch: BatchPrompt) => {
    const results: BatchResult[] = batch.prompts.map((prompt, index) => ({
      promptIndex: index,
      prompt,
      response: `Simulated response for: ${prompt}`,
      timestamp: new Date().toISOString(),
      executionTime: Math.random() * 5000 + 1000, // 1-6 seconds
      success: Math.random() > 0.1 // 90% success rate
    }));
    
    setBatches(prev =>
      prev.map(b =>
        b.id === batch.id
          ? {
              ...b,
              lastRun: new Date().toISOString(),
              nextRun: calculateNextRun(b.schedule),
              results: [...results, ...b.results.slice(0, 50)] // Keep last 50 results
            }
          : b
      )
    );
    
    Alert.alert('Execution Complete', `Batch "${batch.name}" completed successfully.`);
  };
  
  const addPromptField = () => {
    setNewBatch(prev => ({
      ...prev,
      prompts: [...(prev.prompts || []), '']
    }));
  };
  
  const updatePrompt = (index: number, value: string) => {
    setNewBatch(prev => ({
      ...prev,
      prompts: prev.prompts?.map((p, i) => i === index ? value : p) || []
    }));
  };
  
  const removePrompt = (index: number) => {
    setNewBatch(prev => ({
      ...prev,
      prompts: prev.prompts?.filter((_, i) => i !== index) || []
    }));
  };
  
  const renderBatchCard = (batch: BatchPrompt) => (
    <View key={batch.id} style={styles.batchCard}>
      <View style={styles.batchHeader}>
        <View style={styles.batchInfo}>
          <Text style={styles.batchName}>{batch.name}</Text>
          <Text style={styles.batchSchedule}>
            {batch.schedule.type} at {batch.schedule.time}
          </Text>
        </View>
        
        <View style={styles.batchControls}>
          <Switch
            value={batch.enabled}
            onValueChange={() => toggleBatch(batch.id)}
            trackColor={{ false: '#767577', true: '#00D084' }}
          />
        </View>
      </View>
      
      <View style={styles.batchStats}>
        <Text style={styles.statItem}>
          📝 {batch.prompts.length} prompts
        </Text>
        {batch.lastRun && (
          <Text style={styles.statItem}>
            🕒 Last: {new Date(batch.lastRun).toLocaleString()}
          </Text>
        )}
        <Text style={styles.statItem}>
          ⏰ Next: {new Date(batch.nextRun).toLocaleString()}
        </Text>
      </View>
      
      <View style={styles.batchActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => runBatchNow(batch)}
        >
          <Text style={styles.actionButtonText}>▶️ Run Now</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>📝 Edit</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>📊 Results</Text>
        </TouchableOpacity>
      </View>
      
      {batch.results.length > 0 && (
        <View style={styles.recentResults}>
          <Text style={styles.resultsTitle}>Recent Results:</Text>
          {batch.results.slice(0, 3).map((result, index) => (
            <View key={index} style={styles.resultItem}>
              <Text style={styles.resultStatus}>
                {result.success ? '✅' : '❌'}
              </Text>
              <Text style={styles.resultText} numberOfLines={1}>
                {result.prompt}
              </Text>
              <Text style={styles.resultTime}>
                {new Date(result.timestamp).toLocaleTimeString()}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
  
  return (
    <FeatureGate feature="batch_prompts">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>⚡ Batch Prompt Scheduler</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.createButtonText}>+ Create</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.batchList}>
          {batches.length > 0 ? (
            batches.map(renderBatchCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                ⚡ No scheduled batches
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Create automated prompt sequences to run on schedule
              </Text>
            </View>
          )}
        </ScrollView>
        
        <Modal
          visible={showCreateModal}
          animationType="slide"
          presentationStyle="formSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Create Batch</Text>
              <TouchableOpacity onPress={createBatch}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              <Text style={styles.fieldLabel}>Batch Name</Text>
              <TextInput
                style={styles.textInput}
                value={newBatch.name}
                onChangeText={(text) => setNewBatch(prev => ({ ...prev, name: text }))}
                placeholder="Enter batch name..."
                placeholderTextColor="#969696"
              />
              
              <Text style={styles.fieldLabel}>Prompts</Text>
              {newBatch.prompts?.map((prompt, index) => (
                <View key={index} style={styles.promptRow}>
                  <TextInput
                    style={[styles.textInput, styles.promptInput]}
                    value={prompt}
                    onChangeText={(text) => updatePrompt(index, text)}
                    placeholder={`Prompt ${index + 1}...`}
                    placeholderTextColor="#969696"
                    multiline
                  />
                  {newBatch.prompts!.length > 1 && (
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removePrompt(index)}
                    >
                      <Text style={styles.removeButtonText}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              
              <TouchableOpacity style={styles.addPromptButton} onPress={addPromptField}>
                <Text style={styles.addPromptText}>+ Add Prompt</Text>
              </TouchableOpacity>
              
              <Text style={styles.fieldLabel}>Schedule</Text>
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>Type:</Text>
                {['once', 'daily', 'weekly', 'monthly'].map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.scheduleOption,
                      newBatch.schedule?.type === type && styles.selectedSchedule
                    ]}
                    onPress={() => setNewBatch(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule!, type: type as any }
                    }))}
                  >
                    <Text style={styles.scheduleOptionText}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>Time:</Text>
                <TextInput
                  style={styles.timeInput}
                  value={newBatch.schedule?.time || ''}
                  onChangeText={(text) => setNewBatch(prev => ({
                    ...prev,
                    schedule: { ...prev.schedule#!/usr/bin/env bash

echo "🔥 IMPLEMENTING MISSING PREMIUM FEATURES FROM PROMPT"
echo "=================================================="

# Missing features that need to be implemented:
# 1. Live capture toggles (Silver tier)
# 2. Semantic code search (Gold tier)  
# 3. Diff viewer (Gold tier)
# 4. Scheduled batch prompts (Gold tier)
# 5. Priority auto-updates (Gold tier)
# 6. Early-access betas (Platinum tier)

echo "📋 Adding missing premium features..."

# Live Capture System (Silver Tier)
cat > src/components/capture/LiveCaptureManager.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { FeatureGate } from '../../billing/components/FeatureGate';
import { useFeatureAccess } from '../../billing/utils/useFeatureAccess';

interface CaptureSettings {
  toolCalls: boolean;
  notebooks: boolean;
  artifacts: boolean;
  conversations: boolean;
  autoSave: boolean;
  realTimeSync: boolean;
}

export const LiveCaptureManager: React.FC = () => {
  const [settings, setSettings] = useState<CaptureSettings>({
    toolCalls: true,
    notebooks: true,
    artifacts: true,
    conversations: false,
    autoSave: false,
    realTimeSync: false
  });
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedItems, setCapturedItems] = useState<any[]>([]);
  
  const { hasAccess, recordUsage } = useFeatureAccess('live_capture');
  
  useEffect(() => {
    if (isCapturing && hasAccess) {
      startLiveCapture();
    } else {
      stopLiveCapture();
    }
  }, [isCapturing, hasAccess]);
  
  const startLiveCapture = async () => {
    await recordUsage();
    console.log('🎥 Starting live capture with settings:', settings);
    
    // Setup WebSocket listeners for real-time capture
    setupCaptureListeners();
  };
  
  const stopLiveCapture = () => {
    console.log('⏹️ Stopping live capture');
    // Cleanup listeners
  };
  
  const setupCaptureListeners = () => {
    // Listen for tool calls
    if (settings.toolCalls) {
      window.addEventListener('chatgpt-tool-call', handleToolCall);
    }
    
    // Listen for artifacts
    if (settings.artifacts) {
      window.addEventListener('chatgpt-artifact', handleArtifact);
    }
    
    // Listen for conversation updates
    if (settings.conversations) {
      window.addEventListener('chatgpt-message', handleMessage);
    }
  };
  
  const handleToolCall = (event: any) => {
    const toolCall = event.detail;
    
    const capturedItem = {
      id: Date.now().toString(),
      type: 'tool_call',
      timestamp: new Date(),
      data: {
        tool: toolCall.tool_name,
        code: toolCall.code,
        result: toolCall.result
      }
    };
    
    setCapturedItems(prev => [capturedItem, ...prev]);
    
    if (settings.autoSave) {
      saveToStorage(capturedItem);
    }
  };
  
  const handleArtifact = (event: any) => {
    const artifact = event.detail;
    
    const capturedItem = {
      id: Date.now().toString(),
      type: 'artifact',
      timestamp: new Date(),
      data: artifact
    };
    
    setCapturedItems(prev => [capturedItem, ...prev]);
    
    if (settings.autoSave) {
      saveToStorage(capturedItem);
    }
  };
  
  const handleMessage = (event: any) => {
    const message = event.detail;
    
    const capturedItem = {
      id: Date.now().toString(),
      type: 'message',
      timestamp: new Date(),
      data: {
        role: message.role,
        content: message.content,
        conversationId: message.conversation_id
      }
    };
    
    setCapturedItems(prev => [capturedItem, ...prev]);
    
    if (settings.autoSave) {
      saveToStorage(capturedItem);
    }
  };
  
  const saveToStorage = async (item: any) => {
    // Save to secure storage or database
    console.log('💾 Auto-saving captured item:', item.type);
  };
  
  const updateSetting = (key: keyof CaptureSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const exportCapturedData = async () => {
    const data = {
      settings,
      capturedItems,
      exportedAt: new Date().toISOString()
    };
    
    // Export as JSON
    console.log('📤 Exporting captured data:', data);
  };
  
  return (
    <FeatureGate feature="live_capture">
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Live Capture Settings</Text>
          <View style={styles.masterToggle}>
            <Text style={styles.toggleLabel}>Live Capture</Text>
            <Switch
              value={isCapturing}
              onValueChange={setIsCapturing}
              trackColor={{ false: '#767577', true: '#00D084' }}
              thumbColor={isCapturing ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>
        
        {isCapturing && (
          <View style={styles.statusIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.statusText}>
              Capturing • {capturedItems.length} items
            </Text>
          </View>
        )}
        
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Capture Types</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>🛠️ Tool Calls & Notebooks</Text>
            <Switch
              value={settings.toolCalls}
              onValueChange={(value) => updateSetting('toolCalls', value)}
              trackColor={{ false: '#767577', true: '#00D084' }}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>📋 Artifacts & Canvas</Text>
            <Switch
              value={settings.artifacts}
              onValueChange={(value) => updateSetting('artifacts', value)}
              trackColor={{ false: '#767577', true: '#00D084' }}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>💬 Conversation Text</Text>
            <Switch
              value={settings.conversations}
              onValueChange={(value) => updateSetting('conversations', value)}
              trackColor={{ false: '#767577', true: '#00D084' }}
            />
          </View>
        </View>
        
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Advanced Options</Text>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>💾 Auto-save Items</Text>
            <Switch
              value={settings.autoSave}
              onValueChange={(value) => updateSetting('autoSave', value)}
              trackColor={{ false: '#767577', true: '#00D084' }}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>🔄 Real-time Sync</Text>
            <Switch
              value={settings.realTimeSync}
              onValueChange={(value) => updateSetting('realTimeSync', value)}
              trackColor={{ false: '#767577', true: '#00D084' }}
            />
          </View>
        </View>
        
        {capturedItems.length > 0 && (
          <View style={styles.actionsSection}>
            <TouchableOpacity style={styles.exportButton} onPress={exportCapturedData}>
              <Text style={styles.exportButtonText}>📤 Export Captured Data</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.clearButton} 
              onPress={() => setCapturedItems([])}
            >
              <Text style={styles.clearButtonText}>🗑️ Clear All</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={styles.recentItems}>
          <Text style={styles.sectionTitle}>Recent Captures</Text>
          {capturedItems.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.captureItem}>
              <Text style={styles.captureType}>
                {item.type === 'tool_call' ? '🛠️' : 
                 item.type === 'artifact' ? '📋' : '💬'}
              </Text>
              <View style={styles.captureDetails}>
                <Text style={styles.captureTitle}>
                  {item.type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.captureTime}>
                  {item.timestamp.toLocaleTimeString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </FeatureGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  masterToggle: {
    alignItems: 'center',
  },
  toggleLabel: {
    color: '#cccccc',
    fontSize: 12,
    marginBottom: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#2d2d30',
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  recordingDot: {
    width: 8,
    height: 8,
    backgroundColor: '#ff4444',
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  settingsSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#cccccc',
    flex: 1,
  },
  actionsSection: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  exportButton: {
    flex: 1,
    backgroundColor: '#00D084',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#ff4444',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recentItems: {
    padding: 20,
  },
  captureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  captureType: {
    fontSize: 20,
    marginRight: 12,
  },
  captureDetails: {
    flex: 1,
  },
  captureTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  captureTime: {
    fontSize: 12,
    color: '#969696',
  },
});
EOF

# Semantic Code Search (Gold Tier)
cat > src/components/search/SemanticCodeSearch.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { FeatureGate } from '../../billing/components/FeatureGate';
import { useFeatureAccess } from '../../billing/utils/useFeatureAccess';

interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  file: string;
  line: number;
  similarity: number;
  language: string;
  context: string[];
}

interface SearchFilters {
  language: string[];
  fileTypes: string[];
  dateRange: 'all' | 'week' | 'month' | 'year';
  minSimilarity: number;
}

export const SemanticCodeSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    language: [],
    fileTypes: ['py', 'js', 'ts', 'jsx', 'tsx'],
    dateRange: 'all',
    minSimilarity: 0.5
  });
  const [showFilters, setShowFilters] = useState(false);
  
  const { hasAccess, recordUsage } = useFeatureAccess('semantic_search');
  
  const performSemanticSearch = async () => {
    if (!query.trim() || !hasAccess) return;
    
    setIsSearching(true);
    await recordUsage();
    
    try {
      // Simulate semantic search API call
      const searchResults = await simulateSemanticSearch(query, filters);
      setResults(searchResults);
    } catch (error) {
      console.error('Semantic search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  const simulateSemanticSearch = async (
    searchQuery: string, 
    searchFilters: SearchFilters
  ): Promise<SearchResult[]> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock search results based on query
    const mockResults: SearchResult[] = [
      {
        id: '1',
        title: 'Data visualization with matplotlib',
        snippet: 'plt.figure(figsize=(10, 6))\nplt.plot(data["x"], data["y"])\nplt.title("Sample Visualization")',
        file: 'analysis/visualizations.py',
        line: 45,
        similarity: 0.92,
        language: 'python',
        context: [
          'import matplotlib.pyplot as plt',
          'import pandas as pd',
          'def create_plot(data):'
        ]
      },
      {
        id: '2',
        title: 'Machine learning model training',
        snippet: 'model = RandomForestRegressor(n_estimators=100)\nmodel.fit(X_train, y_train)\naccuracy = model.score(X_test, y_test)',
        file: 'ml/model_training.py',
        line: 78,
        similarity: 0.87,
        language: 'python',
        context: [
          'from sklearn.ensemble import RandomForestRegressor',
          'from sklearn.model_selection import train_test_split',
          'def train_model(X, y):'
        ]
      },
      {
        id: '3',
        title: 'API endpoint implementation',
        snippet: '@app.route("/api/predict", methods=["POST"])\ndef predict():\n    data = request.get_json()\n    return jsonify(model.predict(data))',
        file: 'api/endpoints.py',
        line: 23,
        similarity: 0.83,
        language: 'python',
        context: [
          'from flask import Flask, request, jsonify',
          'app = Flask(__name__)',
          '# Prediction endpoints'
        ]
      },
      {
        id: '4',
        title: 'React component with hooks',
        snippet: 'const [data, setData] = useState(null);\nuseEffect(() => {\n  fetchData().then(setData);\n}, []);',
        file: 'components/DataViewer.tsx',
        line: 12,
        similarity: 0.79,
        language: 'typescript',
        context: [
          'import React, { useState, useEffect } from "react";',
          'interface Props { id: string; }',
          'export const DataViewer: React.FC<Props> = ({ id }) => {'
        ]
      }
    ];
    
    // Filter by language if specified
    let filteredResults = mockResults;
    if (searchFilters.language.length > 0) {
      filteredResults = filteredResults.filter(result => 
        searchFilters.language.includes(result.language)
      );
    }
    
    // Filter by similarity threshold
    filteredResults = filteredResults.filter(result => 
      result.similarity >= searchFilters.minSimilarity
    );
    
    // Sort by similarity
    return filteredResults.sort((a, b) => b.similarity - a.similarity);
  };
  
  const toggleLanguageFilter = (language: string) => {
    setFilters(prev => ({
      ...prev,
      language: prev.language.includes(language)
        ? prev.language.filter(l => l !== language)
        : [...prev.language, language]
    }));
  };
  
  const renderSearchResult = (result: SearchResult) => (
    <TouchableOpacity key={result.id} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultTitle}>{result.title}</Text>
        <View style={styles.similarityBadge}>
          <Text style={styles.similarityText}>
            {Math.round(result.similarity * 100)}%
          </Text>
        </View>
      </View>
      
      <Text style={styles.resultFile}>
        📄 {result.file}:{result.line}
      </Text>
      
      <View style={styles.codeSnippet}>
        <Text style={styles.codeText}>{result.snippet}</Text>
      </View>
      
      <View style={styles.contextSection}>
        <Text style={styles.contextLabel}>Context:</Text>
        {result.context.map((line, index) => (
          <Text key={index} style={styles.contextLine}>
            {line}
          </Text>
        ))}
      </View>
      
      <View style={styles.resultFooter}>
        <Text style={styles.languageBadge}>{result.language}</Text>
        <TouchableOpacity style={styles.openButton}>
          <Text style={styles.openButtonText}>Open File</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
  
  return (
    <FeatureGate feature="semantic_search">
      <View style={styles.container}>
        <View style={styles.searchHeader}>
          <Text style={styles.title}>🔍 Semantic Code Search</Text>
          <Text style={styles.subtitle}>
            Find code by meaning, not just keywords
          </Text>
        </View>
        
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search for code patterns, functions, or concepts..."
            placeholderTextColor="#969696"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={performSemanticSearch}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={performSemanticSearch}
            disabled={isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>🔍</Text>
            )}
          </TouchableOpacity>
        </View>
        
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Text style={styles.filterButtonText}>
              ⚙️ Filters {showFilters ? '▼' : '▶️'}
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.resultCount}>
            {results.length} results
          </Text>
        </View>
        
        {showFilters && (
          <View style={styles.filtersPanel}>
            <Text style={styles.filterSectionTitle}>Languages</Text>
            <View style={styles.filterTags}>
              {['python', 'javascript', 'typescript', 'java', 'cpp'].map(lang => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.filterTag,
                    filters.language.includes(lang) && styles.filterTagActive
                  ]}
                  onPress={() => toggleLanguageFilter(lang)}
                >
                  <Text style={[
                    styles.filterTagText,
                    filters.language.includes(lang) && styles.filterTagTextActive
                  ]}>
                    {lang}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <Text style={styles.filterSectionTitle}>Similarity Threshold</Text>
            <View style={styles.similaritySlider}>
              <Text style={styles.similarityLabel}>
                {Math.round(filters.minSimilarity * 100)}%
              </Text>
            </View>
          </View>
        )}
        
        <ScrollView style={styles.resultsContainer}>
          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00D084" />
              <Text style={styles.loadingText}>
                Searching through your codebase...
              </Text>
            </View>
          ) : results.length > 0 ? (
            results.map(renderSearchResult)
          ) : query.trim() ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>
                No results found for "{query}"
              </Text>
              <Text style={styles.noResultsSubtext}>
                Try adjusting your search terms or filters
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                🔍 Start typing to search your code
              </Text>
              <Text style={styles.emptyStateSubtext}>
                Find functions, patterns, or concepts using natural language
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </FeatureGate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  searchHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#969696',
  },
  searchBar: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#2d2d30',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#00D084',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  filterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  filterButton: {
    paddingVertical: 8,
  },
  filterButtonText: {
    color: '#00D084',
    fontSize: 14,
    fontWeight: '500',
  },
  resultCount: {
    color: '#969696',
    fontSize: 14,
  },
  filtersPanel: {
    backgroundColor: '#2d2d30',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3e3e42',
  },
  filterSectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3e3e42',
    borderRadius: 16,
  },
  filterTagActive: {
    backgroundColor: '#00D084',
  },
  filterTagText: {
    color: '#cccccc',
    fontSize: 12,
  },
  filterTagTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  similaritySlider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  similarityLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#969696',
    fontSize: 16,
    marginTop: 16,
  },
  resultCard: {
    backgroundColor: '#2d2d30',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#3e3e42',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
  },
  similarityBadge: {
    backgroundColor: '#00D084',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  similarityText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  resultFile: {
    color: '#969696',
    fontSize: 14,
    marginBottom: 12,
  },
  codeSnippet: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  codeText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contextSection: {
    marginBottom: 12,
  },
  contextLabel: {
    color: '#969696',
    fontSize: 12,
    marginBottom: 4,
  },
  contextLine: {
    color: '#cccccc',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginLeft: 8,
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languageBadge: {
    color: '#00D084',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  openButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  noResults: {
    alignItems: 'center',
    padding: 40,
  },
  noResultsText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  noResultsSubtext: {
    color: '#969696',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    color: '#969696',
    fontSize: 14,
    textAlign: 'center',
  },
});
EOF

# Advanced Diff Viewer (Gold Tier)
cat > src/components/diff/AdvancedDiffVi