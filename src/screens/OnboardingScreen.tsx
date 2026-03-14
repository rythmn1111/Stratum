import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GlassCard } from '../components/GlassCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { SectionLabel } from '../components/SectionLabel';
import { theme } from '../constants/theme';
import { useWallet } from '../context/WalletContext';
import { generateMnemonic, validateMnemonic } from '../services/cryptoService';

type Step = 'welcome' | 'seed' | 'password';
type Mode = 'create' | 'import';

const STEP_LABELS = ['Choose', 'Seed Phrase', 'Password'];

export const OnboardingScreen: React.FC = () => {
  const { setupWallet } = useWallet();
  const [step, setStep] = useState<Step>('welcome');
  const [mode, setMode] = useState<Mode>('create');
  const [mnemonic, setMnemonic] = useState('');
  const [importInput, setImportInput] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);
  const [mnemonicBackedUp, setMnemonicBackedUp] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const stepIndex: Record<Step, number> = { welcome: 0, seed: 1, password: 2 };

  const onSelectCreate = () => {
    const m = generateMnemonic();
    setMnemonic(m);
    setShowMnemonic(false);
    setMnemonicBackedUp(false);
    setMode('create');
    setStep('seed');
  };

  const onSelectImport = () => {
    setMode('import');
    setImportInput('');
    setStep('seed');
  };

  const onSeedNext = () => {
    if (mode === 'create') {
      if (!mnemonicBackedUp) {
        Alert.alert('Backup required', 'Check the box confirming you wrote down your seed phrase.');
        return;
      }
    } else {
      const normalised = importInput.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!validateMnemonic(normalised)) {
        Alert.alert('Invalid seed phrase', 'The words you entered are not a valid BIP39 mnemonic. Check spacing and spelling.');
        return;
      }
      setMnemonic(normalised);
    }
    setStep('password');
  };

  const onSetupWallet = async () => {
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Both passwords must match.');
      return;
    }
    setLoading(true);
    try {
      await setupWallet(password, mnemonic);
      Alert.alert('Wallet ready', 'Your split-key wallet has been configured. Keep your NFC card safe.');
    } catch (err) {
      Alert.alert('Setup failed', err instanceof Error ? err.message : 'Unable to setup wallet.');
    } finally {
      setLoading(false);
      setPassword('');
      setConfirmPassword('');
      setMnemonic('');
      setImportInput('');
    }
  };

  // ── Step indicator ──────────────────────────────────────────
  const currentIndex = stepIndex[step];

  const renderStepIndicator = () => (
    <View style={styles.stepRow}>
      {STEP_LABELS.map((label, i) => (
        <React.Fragment key={label}>
          <View style={styles.stepItem}>
            <View style={[styles.stepDot, i <= currentIndex && styles.stepDotActive]}>
              <Text style={[styles.stepNum, i <= currentIndex && styles.stepNumActive]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, i === currentIndex && styles.stepLabelActive]}>
              {label}
            </Text>
          </View>
          {i < STEP_LABELS.length - 1 && (
            <View style={[styles.stepLine, i < currentIndex && styles.stepLineActive]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  // ── Welcome step ─────────────────────────────────────────────
  const renderWelcomeStep = () => (
    <View>
      <Text style={styles.hero}>NFC Split-Key{'\n'}Wallet</Text>
      <Text style={styles.heroSub}>
        Your private key is split across two cryptographic shares: one on your NFC card, one on the
        server. Both are required to spend funds — so a stolen card or server breach alone is useless.
      </Text>

      <GlassCard>
        <Text style={styles.cardSectionLabel}>Security Model</Text>
        <Text style={styles.cardBody}>
          {'• Stolen card alone → useless\n• Server breach alone → useless\n• Both required to reconstruct the key'}
        </Text>
      </GlassCard>

      <View style={styles.choiceRow}>
        <Pressable style={styles.choiceBtn} onPress={onSelectCreate}>
          <Text style={styles.choiceBtnTitle}>Create Wallet</Text>
          <Text style={styles.choiceBtnSub}>Generate a new seed phrase</Text>
        </Pressable>
        <Pressable style={[styles.choiceBtn, styles.choiceBtnOutline]} onPress={onSelectImport}>
          <Text style={[styles.choiceBtnTitle, styles.choiceBtnTitleOutline]}>Import Wallet</Text>
          <Text style={[styles.choiceBtnSub, styles.choiceBtnSubOutline]}>Restore from existing seed</Text>
        </Pressable>
      </View>
    </View>
  );

  // ── Create: seed display step ─────────────────────────────────
  const renderCreateSeedStep = () => {
    const words = mnemonic.split(' ');
    return (
      <View>
        <Text style={styles.stepTitle}>Your Recovery Seed</Text>
        <Text style={styles.stepDesc}>
          Write these 12 words on paper in order. Never screenshot, email, or store them digitally.
        </Text>

        <GlassCard>
          <View style={styles.seedHeaderRow}>
            <Text style={styles.seedHint}>
              {showMnemonic ? 'Tap Hide when done' : 'Tap Reveal to show words'}
            </Text>
            <Pressable onPress={() => setShowMnemonic((v) => !v)} style={styles.toggleBtn}>
              <Text style={styles.toggleBtnText}>{showMnemonic ? 'Hide' : 'Reveal'}</Text>
            </Pressable>
          </View>

          <View style={styles.wordGrid}>
            {words.map((word, i) => (
              <View key={i} style={styles.wordItem}>
                <View style={styles.wordBadge}>
                  <Text style={styles.wordIndex}>{i + 1}</Text>
                </View>
                {showMnemonic ? (
                  <Text style={styles.wordText}>{word}</Text>
                ) : (
                  <View style={styles.wordBlur} />
                )}
              </View>
            ))}
          </View>
        </GlassCard>

        <Text style={styles.dangerNote}>
          ⚠️  Anyone with this phrase can steal all your funds. Never share it.
        </Text>

        <Pressable style={styles.checkRow} onPress={() => setMnemonicBackedUp((v) => !v)}>
          <View style={[styles.checkbox, mnemonicBackedUp && styles.checkboxOn]} />
          <Text style={styles.checkLabel}>I have written down my seed phrase offline and securely.</Text>
        </Pressable>

        <PrimaryButton title="Continue →" onPress={onSeedNext} />
        <Pressable style={styles.backLink} onPress={() => setStep('welcome')}>
          <Text style={styles.backLinkText}>← Back</Text>
        </Pressable>
      </View>
    );
  };

  // ── Import: seed entry step ───────────────────────────────────
  const renderImportSeedStep = () => (
    <View>
      <Text style={styles.stepTitle}>Import Seed Phrase</Text>
      <Text style={styles.stepDesc}>
        Enter your 12 or 24 word BIP39 seed phrase separated by single spaces.
      </Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        value={importInput}
        onChangeText={setImportInput}
        placeholder="word1 word2 word3 ..."
        placeholderTextColor={theme.colors.textSecondary}
        multiline
        numberOfLines={4}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
      />
      <PrimaryButton title="Verify & Continue →" onPress={onSeedNext} />
      <Pressable style={styles.backLink} onPress={() => setStep('welcome')}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>
    </View>
  );

  // ── Password step ─────────────────────────────────────────────
  const renderPasswordStep = () => (
    <View>
      <Text style={styles.stepTitle}>Protect Your Wallet</Text>
      <Text style={styles.stepDesc}>
        This password encrypts your key before writing Share A to your NFC card.
      </Text>

      <SectionLabel label="Password" />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="At least 8 characters"
        placeholderTextColor={theme.colors.textSecondary}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Confirm password"
        placeholderTextColor={theme.colors.textSecondary}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        autoCapitalize="none"
      />

      <GlassCard>
        <Text style={styles.nfcHint}>
          📳  After tapping Setup Wallet, hold your writable NFC card (NTAG215/NTAG216) against the
          back of your phone until setup completes.
        </Text>
      </GlassCard>

      <PrimaryButton title="Setup Wallet & Write NFC" onPress={onSetupWallet} loading={loading} />
      <Pressable style={styles.backLink} onPress={() => setStep('seed')}>
        <Text style={styles.backLinkText}>← Back</Text>
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.kbv}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {renderStepIndicator()}
        {step === 'welcome' && renderWelcomeStep()}
        {step === 'seed' && mode === 'create' && renderCreateSeedStep()}
        {step === 'seed' && mode === 'import' && renderImportSeedStep()}
        {step === 'password' && renderPasswordStep()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  kbv: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { padding: theme.spacing.lg, paddingBottom: 48 },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  stepItem: { alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  stepDotActive: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  stepNum: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700' },
  stepNumActive: { color: theme.colors.background },
  stepLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    width: 62,
  },
  stepLabelActive: { color: theme.colors.textPrimary },
  stepLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: theme.colors.border,
    marginBottom: 18,
    marginHorizontal: 4,
  },
  stepLineActive: { backgroundColor: theme.colors.accent },

  // Welcome
  hero: {
    color: theme.colors.textPrimary,
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 42,
    marginBottom: theme.spacing.sm,
  },
  heroSub: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  cardSectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  cardBody: { color: theme.colors.textPrimary, lineHeight: 22 },
  choiceRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  choiceBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
  },
  choiceBtnTitle: {
    color: theme.colors.background,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 2,
  },
  choiceBtnTitleOutline: { color: theme.colors.accent },
  choiceBtnSub: {
    color: theme.colors.background,
    fontSize: 11,
    opacity: 0.75,
    textAlign: 'center',
  },
  choiceBtnSubOutline: { color: theme.colors.textSecondary, opacity: 1 },

  // Seed step
  stepTitle: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: theme.spacing.xs,
  },
  stepDesc: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  seedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  seedHint: { color: theme.colors.textSecondary, fontSize: 13 },
  toggleBtn: {
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  toggleBtnText: { color: theme.colors.accent, fontWeight: '700', fontSize: 13 },
  wordGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: '30%',
    minWidth: 90,
  },
  wordBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 5,
    flexShrink: 0,
  },
  wordIndex: { color: theme.colors.textSecondary, fontSize: 9, fontWeight: '700' },
  wordText: { color: theme.colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
  wordBlur: { flex: 1, height: 12, backgroundColor: theme.colors.border, borderRadius: 4 },
  dangerNote: {
    color: theme.colors.warning,
    fontSize: 13,
    marginVertical: theme.spacing.sm,
    lineHeight: 18,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    marginRight: theme.spacing.sm,
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  checkLabel: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // Import
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },

  // Password step
  nfcHint: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 21 },

  // Shared
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.textPrimary,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    fontSize: 15,
  },
  backLink: { alignItems: 'center', paddingVertical: theme.spacing.md },
  backLinkText: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' },
});

