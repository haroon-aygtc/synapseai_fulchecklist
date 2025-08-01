import React, { useMemo, useCallback } from 'react';
import { useForm, Controller, FieldValues, Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  CalendarIcon, 
  Upload, 
  X, 
  Plus, 
  Minus, 
  AlertCircle,
  Info,
  CheckCircle2
} from 'lucide-react';

import { FormField as FormFieldType } from '@/lib/sdk/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FormGeneratorProps {
  schema: z.ZodSchema<any>;
  fields: FormFieldType[];
  onSubmit: (data: any) => void | Promise<void>;
  onCancel?: () => void;
  defaultValues?: Record<string, any>;
  isLoading?: boolean;
  title?: string;
  description?: string;
  submitLabel?: string;
  cancelLabel?: string;
  className?: string;
  layout?: 'vertical' | 'horizontal' | 'grid';
  columns?: number;
  showProgress?: boolean;
  enableAutoSave?: boolean;
  onAutoSave?: (data: any) => void;
}

const FormFieldRenderer: React.FC<{
  field: FormFieldType;
  control: any;
  watch: any;
  setValue: any;
  errors: any;
}> = ({ field, control, watch, setValue, errors }) => {
  const watchedValues = watch();
  
  // Check conditional visibility
  const isVisible = useMemo(() => {
    if (!field.conditional) return !field.hidden;
    
    const { field: conditionField, value: conditionValue, operator } = field.conditional;
    const fieldValue = watchedValues[conditionField];
    
    switch (operator) {
      case 'equals':
        return fieldValue === conditionValue;
      case 'not-equals':
        return fieldValue !== conditionValue;
      case 'contains':
        return Array.isArray(fieldValue) ? fieldValue.includes(conditionValue) : 
               String(fieldValue).includes(String(conditionValue));
      case 'greater-than':
        return Number(fieldValue) > Number(conditionValue);
      case 'less-than':
        return Number(fieldValue) < Number(conditionValue);
      default:
        return true;
    }
  }, [field.conditional, watchedValues]);

  if (!isVisible) return null;

  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <FormControl>
                  <Input
                    {...formField}
                    placeholder={field.placeholder}
                    disabled={field.disabled}
                    type="text"
                  />
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'number':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <FormControl>
                  <Input
                    {...formField}
                    placeholder={field.placeholder}
                    disabled={field.disabled}
                    type="number"
                    onChange={(e) => formField.onChange(Number(e.target.value))}
                  />
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'boolean':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                    {field.label}
                  </FormLabel>
                  {field.description && (
                    <FormDescription>{field.description}</FormDescription>
                  )}
                </div>
                <FormControl>
                  <Switch
                    checked={formField.value}
                    onCheckedChange={formField.onChange}
                    disabled={field.disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'select':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <Select
                  onValueChange={formField.onChange}
                  defaultValue={formField.value}
                  disabled={field.disabled}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={field.placeholder} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'multiselect':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <div className="space-y-2">
                  {field.options?.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${field.name}-${option.value}`}
                        checked={formField.value?.includes(option.value)}
                        onCheckedChange={(checked) => {
                          const currentValue = formField.value || [];
                          if (checked) {
                            formField.onChange([...currentValue, option.value]);
                          } else {
                            formField.onChange(currentValue.filter((v: any) => v !== option.value));
                          }
                        }}
                        disabled={field.disabled}
                      />
                      <Label htmlFor={`${field.name}-${option.value}`}>
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'date':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem className="flex flex-col">
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !formField.value && "text-muted-foreground"
                        )}
                        disabled={field.disabled}
                      >
                        {formField.value ? (
                          format(formField.value, "PPP")
                        ) : (
                          <span>{field.placeholder || "Pick a date"}</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formField.value}
                      onSelect={formField.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'file':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        formField.onChange(file);
                      }}
                      disabled={field.disabled}
                      className="hidden"
                      id={`file-${field.name}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById(`file-${field.name}`)?.click()}
                      disabled={field.disabled}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                    {formField.value && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          {formField.value.name}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => formField.onChange(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      case 'json':
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...formField}
                    placeholder={field.placeholder || "Enter JSON..."}
                    disabled={field.disabled}
                    className="font-mono text-sm"
                    rows={6}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        formField.onChange(parsed);
                      } catch {
                        formField.onChange(e.target.value);
                      }
                    }}
                    value={typeof formField.value === 'string' ? formField.value : JSON.stringify(formField.value, null, 2)}
                  />
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );

      default:
        return (
          <FormField
            control={control}
            name={field.name}
            render={({ field: formField }) => (
              <FormItem>
                <FormLabel className={field.required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
                  {field.label}
                </FormLabel>
                <FormControl>
                  <Textarea
                    {...formField}
                    placeholder={field.placeholder}
                    disabled={field.disabled}
                    rows={3}
                  />
                </FormControl>
                {field.description && (
                  <FormDescription>{field.description}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
      >
        {renderField()}
      </motion.div>
    </AnimatePresence>
  );
};

export const FormGenerator: React.FC<FormGeneratorProps> = ({
  schema,
  fields,
  onSubmit,
  onCancel,
  defaultValues = {},
  isLoading = false,
  title,
  description,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  className,
  layout = 'vertical',
  columns = 2,
  showProgress = false,
  enableAutoSave = false,
  onAutoSave
}) => {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onChange'
  });

  const { control, handleSubmit, watch, setValue, formState: { errors, isValid, isDirty } } = form;

  // Auto-save functionality
  React.useEffect(() => {
    if (!enableAutoSave || !onAutoSave || !isDirty) return;

    const subscription = watch((data) => {
      const timeoutId = setTimeout(() => {
        onAutoSave(data);
      }, 1000); // Debounce auto-save

      return () => clearTimeout(timeoutId);
    });

    return () => subscription.unsubscribe();
  }, [watch, enableAutoSave, onAutoSave, isDirty]);

  // Calculate progress
  const progress = useMemo(() => {
    if (!showProgress) return 0;
    
    const watchedValues = watch();
    const filledFields = fields.filter(field => {
      const value = watchedValues[field.name];
      return value !== undefined && value !== null && value !== '';
    }).length;
    
    return Math.round((filledFields / fields.length) * 100);
  }, [watch, fields, showProgress]);

  const onSubmitHandler = useCallback(async (data: any) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Form submission error:', error);
    }
  }, [onSubmit]);

  const getLayoutClasses = () => {
    switch (layout) {
      case 'horizontal':
        return 'space-y-6';
      case 'grid':
        return `grid grid-cols-1 md:grid-cols-${columns} gap-6`;
      default:
        return 'space-y-6';
    }
  };

  return (
    <Card className={cn("w-full max-w-4xl mx-auto", className)}>
      {(title || description || showProgress) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {showProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </CardHeader>
      )}

      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit(onSubmitHandler)} className="space-y-6">
            {/* Form Fields */}
            <div className={getLayoutClasses()}>
              {fields.map((field) => (
                <FormFieldRenderer
                  key={field.name}
                  field={field}
                  control={control}
                  watch={watch}
                  setValue={setValue}
                  errors={errors}
                />
              ))}
            </div>

            {/* Auto-save indicator */}
            {enableAutoSave && isDirty && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Changes are automatically saved as you type.
                </AlertDescription>
              </Alert>
            )}

            {/* Form validation summary */}
            {Object.keys(errors).length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please fix the following errors:
                  <ul className="mt-2 list-disc list-inside">
                    {Object.entries(errors).map(([field, error]) => (
                      <li key={field} className="text-sm">
                        {fields.find(f => f.name === field)?.label || field}: {error?.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success indicator */}
            {isValid && isDirty && Object.keys(errors).length === 0 && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  All fields are valid and ready to submit.
                </AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  {cancelLabel}
                </Button>
              )}
              
              <Button
                type="submit"
                disabled={isLoading || !isValid}
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default FormGenerator;