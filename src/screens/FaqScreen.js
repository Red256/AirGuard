import React, { useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { Header, Screen } from '../components/ui';
import { getFaqCategories, LEVEL_CARDS, levelRows } from '../data/faq';
import { AlertTriangle, InfoBadge } from '../components/Icons';
import { cardShadow, colors, palettes } from '../theme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = [
  { id: 0, title: 'Quick Facts', icon: '🎯' },
  { id: 1, title: 'FAQ', icon: '❓' },
];

const NEWLINE = String.fromCharCode(10);

// Answers are written as lines. A line starting with "• " becomes a bullet whose wrapped
// lines stay lined up with the first line of text, not under the bullet.
function AnswerLines({ answer }) {
  return answer.split(NEWLINE).map((line, i) => {
    if (line.startsWith('• ')) {
      return (
        <View key={i} style={styles.bulletRow}>
          <Text style={[styles.answerText, styles.bulletDot]}>•</Text>
          <Text style={[styles.answerText, styles.bulletText]}>{line.slice(2)}</Text>
        </View>
      );
    }
    if (line.trim() === '') return <View key={i} style={styles.answerGap} />;
    return (
      <Text key={i} style={styles.answerText}>
        {line}
      </Text>
    );
  });
}

function FAQItem({ question, answer, isExpanded, onToggle }) {
  return (
    <View style={styles.faqItem}>
      <TouchableOpacity onPress={onToggle} style={styles.questionContainer} accessibilityRole="button" accessibilityState={{ expanded: !!isExpanded }}>
        <Text style={styles.questionText}>{question}</Text>
        <Text style={styles.expandIcon}>{isExpanded ? '−' : '+'}</Text>
      </TouchableOpacity>
      {isExpanded && (
        <View style={styles.answerContainer}>
          <AnswerLines answer={answer} />
        </View>
      )}
    </View>
  );
}

function CategorySection({ category, expandedItems, onToggleItem }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleCategory = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  return (
    <View style={styles.categorySection}>
      <TouchableOpacity onPress={toggleCategory} style={styles.categoryHeader} accessibilityRole="button" accessibilityState={{ expanded: isExpanded }}>
        <View style={styles.categoryTitleContainer}>
          {category.badge === 'info' ? (
            <View style={styles.categoryBadge}>
              <InfoBadge size={28} />
            </View>
          ) : (
            <Text style={styles.categoryIcon}>{category.icon}</Text>
          )}
          <Text style={styles.categoryTitle}>{category.category}</Text>
        </View>
        <Text style={styles.categoryExpandIcon}>{isExpanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.questionsContainer}>
          {category.questions.map((item, index) => (
            <FAQItem
              key={index}
              question={item.question}
              answer={item.answer}
              isExpanded={expandedItems[`${category.id}-${index}`]}
              onToggle={() => onToggleItem(`${category.id}-${index}`)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function QATab() {
  const [expandedItems, setExpandedItems] = useState({});
  const categories = getFaqCategories();

  const toggleItem = (itemKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedItems((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }));
  };

  return (
    <View style={styles.faqContent}>
      {categories.map((category) => (
        <CategorySection key={category.id} category={category} expandedItems={expandedItems} onToggleItem={toggleItem} />
      ))}
    </View>
  );
}

function QuickFactsTab() {
  const rows = levelRows();
  return (
    <View style={styles.faqContent}>
      {LEVEL_CARDS.map((c) => (
        <View key={c.level} style={[styles.levelCard, { borderLeftColor: palettes[c.level].accent }]}>
          <Text style={styles.levelIcon}>{c.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.levelTitle, { color: palettes[c.level].title }]}>{c.title}</Text>
            <Text style={styles.levelText}>{c.text}</Text>
          </View>
        </View>
      ))}

      <View style={styles.tableCard}>
        <Text style={styles.tableTitle}>📏 Ranges at a glance</Text>
        <View style={styles.tableRow}>
          <View style={styles.cellLabel} />
          {['good', 'moderate', 'bad'].map((l) => (
            <View key={l} style={[styles.headCell, { backgroundColor: palettes[l].pillBg }]}>
              {l === 'bad' ? <AlertTriangle size={12} color={palettes.bad.accent} /> : null}
              <Text style={[styles.headText, { color: palettes[l].pillText }, l === 'bad' && { marginLeft: 3 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {l === 'good' ? 'Good' : l === 'moderate' ? 'Moderate' : 'Unhealthy'}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((r) => (
          <View key={r.label} style={[styles.tableRow, styles.tableRowBorder]}>
            <View style={styles.cellLabel}>
              <Text style={styles.labelText}>{r.label}</Text>
              <Text style={styles.unitText}>{r.unit}</Text>
            </View>
            <Text style={styles.cell}>{r.good}</Text>
            <Text style={styles.cell}>{r.moderate}</Text>
            <Text style={styles.cell}>{r.bad}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function FaqScreen() {
  const [activeTab, setActiveTab] = useState(1);

  return (
    <Screen>
      <Header />

      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => setActiveTab(tab.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === tab.id }}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text style={[styles.tabText, activeTab === tab.id && styles.activeTabText]}>{tab.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 0 ? <QuickFactsTab /> : <QATab />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Tabs (modeled on the Coyote Alert FAQ)
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginTop: 4,
    borderRadius: 24,
    padding: 8,
    ...cardShadow,
  },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, alignItems: 'center', borderRadius: 20, marginHorizontal: 2, backgroundColor: palettes.bad.pillBg },
  activeTab: { backgroundColor: '#D5EFD8', ...cardShadow },
  tabIcon: { fontSize: 20, marginBottom: 4 },
  tabText: { fontSize: 12, color: colors.muted, fontWeight: 'bold' },
  activeTabText: { color: colors.navy, fontWeight: 'bold' },

  // Q&A
  faqContent: { paddingTop: 16 },
  categorySection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
  },
  categoryTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  categoryIcon: { fontSize: 24, marginRight: 12 },
  categoryBadge: { width: 33, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  categoryTitle: { fontSize: 18, fontWeight: '600', color: '#2c3e50', flexShrink: 1 },
  categoryExpandIcon: { fontSize: 16, color: '#7f8c8d', fontWeight: 'bold' },
  questionsContainer: { backgroundColor: '#fff' },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  questionContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  questionText: { fontSize: 16, fontWeight: 'bold', color: colors.primary, flex: 1, marginRight: 12, lineHeight: 22 },
  expandIcon: { fontSize: 20, color: '#3498db', fontWeight: 'bold' },
  answerContainer: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4, backgroundColor: '#f8f9fa' },
  answerText: { fontSize: 15, color: '#34495e', lineHeight: 24 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletDot: { width: 16 },
  bulletText: { flex: 1 },
  answerGap: { height: 8 },

  // Quick Facts
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 5,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  levelIcon: { fontSize: 26, marginRight: 14 },
  levelTitle: { fontSize: 18, fontWeight: '700' },
  levelText: { fontSize: 15, color: '#34495e', lineHeight: 21, marginTop: 2 },
  tableCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableTitle: { fontSize: 18, fontWeight: '600', color: '#2c3e50', marginBottom: 10 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  tableRowBorder: { borderTopWidth: 1, borderTopColor: '#f1f2f6' },
  cellLabel: { width: 76, paddingRight: 4 },
  labelText: { fontSize: 12, fontWeight: '700', color: '#2c3e50' },
  unitText: { fontSize: 11, color: '#7f8c8d' },
  headCell: { flex: 1, flexDirection: 'row', borderRadius: 8, paddingVertical: 5, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center' },
  headText: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  cell: { flex: 1, fontSize: 12, color: '#34495e', textAlign: 'center', paddingHorizontal: 1 },
});
