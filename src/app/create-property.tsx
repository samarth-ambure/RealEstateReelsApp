import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/AuthContext';
import {
  createProperty,
  getPropertyById,
  updateProperty,
} from '@/services/propertyService';

type PropertyFormState = {
  title: string;
  price: string;
  location: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  area: string;
  description: string;
  imageUrl: string;
};

type FormErrors = Partial<Record<keyof PropertyFormState, string>>;

const PROPERTY_TYPES = [
  'Apartment',
  'Villa',
  'Townhouse',
  'Penthouse',
  'Bungalow',
  'Single Family',
];

const SAMPLE_IMAGE_URL =
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80';

const INITIAL_FORM: PropertyFormState = {
  title: '',
  price: '',
  location: '',
  propertyType: 'Apartment',
  bedrooms: '2',
  bathrooms: '2',
  area: '',
  description: '',
  imageUrl: '',
};

function formatPriceString(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('$')) {
    return trimmed;
  }
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  if (!digitsOnly) {
    return trimmed;
  }
  const numeric = Number(digitsOnly);
  if (Number.isNaN(numeric)) {
    return trimmed;
  }
  return `$${numeric.toLocaleString()}`;
}

function formatAreaString(input: string): string {
  const trimmed = input.trim();
  if (/sq/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed} sq ft`;
}

export default function CreatePropertyScreen() {
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const propertyId = Array.isArray(id) ? id[0] : id;
  const isEditing = Boolean(propertyId);

  const [form, setForm] = useState<PropertyFormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingExisting, setIsLoadingExisting] = useState(isEditing);
  const [hasImageError, setHasImageError] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) return;

    let isMounted = true;
    const fetchExisting = async () => {
      try {
        const existing = await getPropertyById(propertyId);
        if (isMounted && existing) {
          const rawPrice = existing.price.replace(/[^0-9]/g, '');
          const rawArea = existing.area.replace(/[^0-9]/g, '');

          setForm({
            title: existing.title,
            price: rawPrice ? `$${Number(rawPrice).toLocaleString()}` : existing.price,
            location: existing.location,
            propertyType: existing.propertyType || 'Apartment',
            bedrooms: String(existing.bedrooms),
            bathrooms: String(existing.bathrooms),
            area: rawArea,
            description: existing.description,
            imageUrl: existing.image,
          });
        }
      } catch (err) {
        console.warn('Failed to load property for editing:', err);
      } finally {
        if (isMounted) {
          setIsLoadingExisting(false);
        }
      }
    };

    fetchExisting();

    return () => {
      isMounted = false;
    };
  }, [propertyId]);

  const updateField = (field: keyof PropertyFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (field === 'imageUrl') {
      setHasImageError(false);
    }
  };

  const handleUseSampleImage = () => {
    updateField('imageUrl', SAMPLE_IMAGE_URL);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.title.trim()) {
      newErrors.title = 'Title is required';
    }

    const priceDigits = form.price.replace(/[^0-9]/g, '');
    if (!form.price.trim()) {
      newErrors.price = 'Price is required';
    } else if (!priceDigits || Number(priceDigits) <= 0) {
      newErrors.price = 'Enter a valid positive price';
    }

    if (!form.location.trim()) {
      newErrors.location = 'Location is required';
    }

    if (!form.propertyType.trim()) {
      newErrors.propertyType = 'Property type is required';
    }

    const bedNum = parseInt(form.bedrooms, 10);
    if (!form.bedrooms.trim()) {
      newErrors.bedrooms = 'Bedrooms count is required';
    } else if (Number.isNaN(bedNum) || bedNum < 0) {
      newErrors.bedrooms = 'Enter a valid bedroom count';
    }

    const bathNum = parseInt(form.bathrooms, 10);
    if (!form.bathrooms.trim()) {
      newErrors.bathrooms = 'Bathrooms count is required';
    } else if (Number.isNaN(bathNum) || bathNum < 0) {
      newErrors.bathrooms = 'Enter a valid bathroom count';
    }

    if (!form.area.trim()) {
      newErrors.area = 'Area is required';
    }

    if (!form.description.trim()) {
      newErrors.description = 'Description is required';
    }

    const trimmedUrl = form.imageUrl.trim();
    if (!trimmedUrl) {
      newErrors.imageUrl = 'Image URL is required';
    } else if (!/^https?:\/\//i.test(trimmedUrl)) {
      newErrors.imageUrl = 'Image URL must start with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePublish = async () => {
    if (isSubmitting) {
      return;
    }

    setSubmitErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const numericPrice = Number(form.price.replace(/[^0-9]/g, ''));
      const numericArea = Number(form.area.replace(/[^0-9]/g, ''));

      if (isEditing && propertyId) {
        await updateProperty(propertyId, {
          title: form.title.trim(),
          price: numericPrice,
          location: form.location.trim(),
          propertyType: form.propertyType.trim(),
          bedrooms: parseInt(form.bedrooms, 10),
          bathrooms: parseInt(form.bathrooms, 10),
          area: numericArea,
          description: form.description.trim(),
          image: form.imageUrl.trim(),
        });
        Alert.alert('Success', 'Property updated successfully!');
        router.back();
      } else {
        await createProperty({
          title: form.title.trim(),
          price: numericPrice,
          location: form.location.trim(),
          propertyType: form.propertyType.trim(),
          bedrooms: parseInt(form.bedrooms, 10),
          bathrooms: parseInt(form.bathrooms, 10),
          area: numericArea,
          description: form.description.trim(),
          image: form.imageUrl.trim(),
          agentName: user?.name?.trim() || 'Owner',
          agentImage: user?.profileImage || undefined,
        });
        Alert.alert('Success', 'Property published successfully!');
        router.back();
      }
    } catch (err: any) {
      const message =
        err?.message ||
        `Failed to ${isEditing ? 'update' : 'publish'} property. Please try again.`;
      setSubmitErrorMessage(message);
      Alert.alert(isEditing ? 'Update Error' : 'Publish Error', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const trimmedImageUrl = form.imageUrl.trim();
  const canPreviewImage =
    trimmedImageUrl.length > 0 &&
    /^https?:\/\//i.test(trimmedImageUrl) &&
    !hasImageError;

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.iconButton}
            onPress={() => router.back()}>
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <Text style={styles.screenTitle}>
            {isEditing ? 'Edit Property' : 'Create Property'}
          </Text>

          <View style={styles.headerRightSpacer} />
        </View>

        {isLoadingExisting ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color="#111827" />
            <Text style={{ marginTop: 12, color: '#6b7280', fontSize: 14, fontWeight: '600' }}>
              Loading listing details...
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
          {submitErrorMessage ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{submitErrorMessage}</Text>
            </View>
          ) : null}

          {/* Title */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Property Title <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="e.g. Modern 2 BHK Apartment"
              placeholderTextColor="#9ca3af"
              value={form.title}
              onChangeText={(text) => updateField('title', text)}
            />
            {errors.title ? (
              <Text style={styles.errorText}>{errors.title}</Text>
            ) : null}
          </View>

          {/* Price */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Price <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              placeholder="e.g. 8500000 or $850,000"
              placeholderTextColor="#9ca3af"
              value={form.price}
              keyboardType="numeric"
              onChangeText={(text) => updateField('price', text)}
            />
            {errors.price ? (
              <Text style={styles.errorText}>{errors.price}</Text>
            ) : null}
          </View>

          {/* Location */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Location <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.location && styles.inputError]}
              placeholder="e.g. Baner, Pune"
              placeholderTextColor="#9ca3af"
              value={form.location}
              onChangeText={(text) => updateField('location', text)}
            />
            {errors.location ? (
              <Text style={styles.errorText}>{errors.location}</Text>
            ) : null}
          </View>

          {/* Property Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Property Type <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.chipRow}>
              {PROPERTY_TYPES.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeChip,
                    form.propertyType === type && styles.selectedTypeChip,
                  ]}
                  onPress={() => updateField('propertyType', type)}>
                  <Text
                    style={[
                      styles.typeChipText,
                      form.propertyType === type && styles.selectedTypeChipText,
                    ]}>
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[
                styles.input,
                styles.customTypeInput,
                errors.propertyType && styles.inputError,
              ]}
              placeholder="Or enter custom property type"
              placeholderTextColor="#9ca3af"
              value={form.propertyType}
              onChangeText={(text) => updateField('propertyType', text)}
            />
            {errors.propertyType ? (
              <Text style={styles.errorText}>{errors.propertyType}</Text>
            ) : null}
          </View>

          {/* Bedrooms & Bathrooms Row */}
          <View style={styles.twoColumnRow}>
            <View style={[styles.fieldGroup, styles.flexColumn]}>
              <Text style={styles.label}>
                Bedrooms <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.bedrooms && styles.inputError]}
                placeholder="e.g. 2"
                placeholderTextColor="#9ca3af"
                value={form.bedrooms}
                keyboardType="number-pad"
                onChangeText={(text) => updateField('bedrooms', text)}
              />
              {errors.bedrooms ? (
                <Text style={styles.errorText}>{errors.bedrooms}</Text>
              ) : null}
            </View>

            <View style={[styles.fieldGroup, styles.flexColumn]}>
              <Text style={styles.label}>
                Bathrooms <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, errors.bathrooms && styles.inputError]}
                placeholder="e.g. 2"
                placeholderTextColor="#9ca3af"
                value={form.bathrooms}
                keyboardType="number-pad"
                onChangeText={(text) => updateField('bathrooms', text)}
              />
              {errors.bathrooms ? (
                <Text style={styles.errorText}>{errors.bathrooms}</Text>
              ) : null}
            </View>
          </View>

          {/* Area */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Area <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.area && styles.inputError]}
              placeholder="e.g. 1250 sq.ft"
              placeholderTextColor="#9ca3af"
              value={form.area}
              onChangeText={(text) => updateField('area', text)}
            />
            {errors.area ? (
              <Text style={styles.errorText}>{errors.area}</Text>
            ) : null}
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Description <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                errors.description && styles.inputError,
              ]}
              placeholder="Modern apartment with spacious rooms, balcony views, and premium fittings..."
              placeholderTextColor="#9ca3af"
              value={form.description}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onChangeText={(text) => updateField('description', text)}
            />
            {errors.description ? (
              <Text style={styles.errorText}>{errors.description}</Text>
            ) : null}
          </View>

          {/* Image URL */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelActionRow}>
              <Text style={styles.label}>
                Property Image URL <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Pressable onPress={handleUseSampleImage}>
                <Text style={styles.sampleImageLink}>Use Sample Image</Text>
              </Pressable>
            </View>
            <TextInput
              style={[styles.input, errors.imageUrl && styles.inputError]}
              placeholder="https://images.unsplash.com/..."
              placeholderTextColor="#9ca3af"
              value={form.imageUrl}
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(text) => updateField('imageUrl', text)}
            />
            {errors.imageUrl ? (
              <Text style={styles.errorText}>{errors.imageUrl}</Text>
            ) : null}

            {/* Image Preview */}
            <View style={styles.previewContainer}>
              {canPreviewImage ? (
                <View style={styles.previewWrapper}>
                  <Image
                    source={{ uri: trimmedImageUrl }}
                    style={styles.previewImage}
                    resizeMode="cover"
                    onError={() => setHasImageError(true)}
                  />
                  <View style={styles.previewBadge}>
                    <Text style={styles.previewBadgeText}>Image Preview</Text>
                  </View>
                </View>
              ) : hasImageError ? (
                <View style={styles.previewPlaceholderError}>
                  <Text style={styles.previewErrorText}>
                    Unable to load image from URL. The URL may be invalid or unreachable.
                  </Text>
                </View>
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Text style={styles.previewPlaceholderText}>
                    Image preview will appear here
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Publish / Update Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isEditing ? 'Update Property' : 'Publish Property'}
            style={[
              styles.publishButton,
              isSubmitting && styles.publishButtonDisabled,
            ]}
            disabled={isSubmitting}
            onPress={handlePublish}>
            {isSubmitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.publishButtonText}>
                  {isEditing ? 'Updating...' : 'Publishing...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.publishButtonText}>
                {isEditing ? 'Update Property' : 'Publish Property'}
              </Text>
            )}
          </Pressable>
        </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 16,
    backgroundColor: '#f6f7f9',
    borderBottomWidth: 1,
    borderBottomColor: '#edf0f4',
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  backIcon: {
    color: '#111827',
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '600',
  },
  screenTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '800',
  },
  headerRightSpacer: {
    width: 42,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  errorBannerText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  requiredStar: {
    color: '#ef4444',
  },
  labelActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sampleImageLink: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
    marginLeft: 4,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flexColumn: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  typeChip: {
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  selectedTypeChip: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  typeChipText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '700',
  },
  selectedTypeChipText: {
    color: '#fff',
  },
  customTypeInput: {
    marginTop: 2,
  },
  textArea: {
    minHeight: 100,
  },
  previewContainer: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  previewWrapper: {
    position: 'relative',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111827',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  previewPlaceholder: {
    height: 90,
    borderRadius: 16,
    backgroundColor: '#eef2f6',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  previewPlaceholderText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewPlaceholderError: {
    borderRadius: 16,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewErrorText: {
    color: '#be123c',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  publishButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#111827',
    paddingVertical: 16,
    marginTop: 10,
  },
  publishButtonDisabled: {
    opacity: 0.65,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
