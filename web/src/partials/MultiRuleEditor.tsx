import { Fragment } from "react"
import { useLiveState } from "../hooks/useLiveState"
import type { FC as Component } from "react"
import Modal from "../components/Modal"
import RuleEditor from "./RuleEditor"
import Button from "../components/Button"
import Input from "../components/Input"
import Select from "../components/Select"
import { ConditionType } from "../enums"
import { validateRules } from "../util"
import NumberInput from "../components/NumberInput"
import { Trash2 as IoTrash } from "lucide-react"
import styles from "~styles"
import { Trans, useLingui } from "#lingui"
import { useConditionTypeNames } from "../names"
const DeleteButton: Component<{
    onDelete: () => void
}> = (props) => {
    return (
        <button
            type="button"
            aria-label="Delete rule"
            className={styles.delete}
            onClick={() => props.onDelete()}
        >
            <IoTrash size={16} />
        </button>
    )
}
const defaultMultiRule: MultiRule = {
    name: "",
    rules: [],
    condition: {
        type: ConditionType.Gte,
        value: 1,
    },
}
const RulesetButton: Component<{
    rules: SimpleRule[][]
    onEdit: () => void
}> = (props) => {
    const { t } = useLingui()
    return (
        <Button
            kind="outline"
            className={styles.buttonRuleset}
            onClick={() => props.onEdit()}
            theme={validateRules(props.rules) ? "default" : "error"}
        >
            {t`this ruleset`}
        </Button>
    )
}
const RuleBlockContent: Component<{
    value: MultiRule[]
    onChange: (value: MultiRule[]) => void
    onEdit: (index: integer) => void
    disabled?: boolean
}> = (props) => {
    function onDelete(index: number) {
        props.onChange(props.value.filter((_, i) => i !== index))
    }
    function onAdd() {
        props.onChange([...props.value, defaultMultiRule])
    }
    function editItem(index: number, fn: (v: MultiRule) => MultiRule) {
        props.onChange(props.value.map((x, i) => (index === i ? fn(x) : x)))
    }
    const { t } = useLingui()
    const conditionTypeNames = useConditionTypeNames()
    return (
        <>
            {props.value.map((__value, index) => {
                const item = () => __value
                return (
                    <Fragment key={index}>
                        {
                            <>
                                {index > 0 ? (
                                    <>
                                        <div className={styles.or}>{t`OR`}</div>
                                    </>
                                ) : null}
                                <div className={styles.row}>
                                    <div className={styles.editRow}>
                                        <Trans>
                                            Has{" "}
                                            <Select
                                                className={
                                                    styles.selectConditionType
                                                }
                                                value={item().condition.type}
                                                onChange={(type) =>
                                                    editItem(index, (r) => ({
                                                        ...r,
                                                        condition: {
                                                            ...r.condition,
                                                            type,
                                                        },
                                                    }))
                                                }
                                                options={[
                                                    ConditionType.Gte,
                                                    ConditionType.Lte,
                                                    ConditionType.Eq,
                                                ]}
                                                getLabel={(type) =>
                                                    conditionTypeNames[type]()
                                                }
                                                disabled={props.disabled}
                                            />{" "}
                                            <NumberInput
                                                className={styles.inputCount}
                                                value={item().condition.value}
                                                onChange={(value) =>
                                                    editItem(index, (r) => ({
                                                        ...r,
                                                        condition: {
                                                            ...r.condition,
                                                            value,
                                                        },
                                                    }))
                                                }
                                                emptyValue={-1}
                                                disabled={props.disabled}
                                                maxLength={2}
                                                error={
                                                    item().condition.value <= 0
                                                }
                                            />{" "}
                                            star(s) that satisfy{" "}
                                            <RulesetButton
                                                rules={item().rules}
                                                onEdit={() =>
                                                    props.onEdit(index)
                                                }
                                            />
                                            . Description:{" "}
                                        </Trans>
                                    </div>
                                    <Input
                                        aria-label="Rule description"
                                        disabled={props.disabled}
                                        className={styles.description}
                                        value={item().name}
                                        onChange={(name) =>
                                            editItem(index, (r) => ({
                                                ...r,
                                                name,
                                            }))
                                        }
                                    />
                                    {!props.disabled ? (
                                        <>
                                            <DeleteButton
                                                onDelete={() => onDelete(index)}
                                            />
                                        </>
                                    ) : null}
                                </div>
                            </>
                        }
                    </Fragment>
                )
            })}

            {!props.disabled ? (
                <>
                    <Button
                        className={styles.addOr}
                        kind="outline"
                        onClick={onAdd}
                    >
                        {t`Add OR rule`}
                    </Button>
                </>
            ) : null}
        </>
    )
}
const MultiRuleEditor: Component<{
    value: MultiRule[][]
    onChange: (value: MultiRule[][]) => void
    disabled?: boolean
}> = (props) => {
    const [editing, setEditing] = useLiveState<[number, number] | null>(null)
    function onRulesChange(rules: SimpleRule[][]) {
        if (!editing() || props.disabled) return
        const [ei, ej] = editing()!
        props.onChange(
            props.value.map((x, i) =>
                i === ei
                    ? x.map((y, j) =>
                          j === ej
                              ? {
                                    ...y,
                                    rules,
                                }
                              : y,
                      )
                    : x,
            ),
        )
    }
    function onBlockChange(group: MultiRule[], index: number) {
        if (group.length > 0) {
            props.onChange(props.value.map((v, i) => (i === index ? group : v)))
        } else {
            const result = props.value.filter((_, i) => i !== index)
            if (result.length === 0) {
                props.onChange([[defaultMultiRule]])
            } else {
                props.onChange(result)
            }
        }
    }
    function onAdd() {
        props.onChange([...props.value, [defaultMultiRule]])
    }
    const { t } = useLingui()
    const selected = editing()
    const editingRule = selected
        ? props.value[selected[0]]?.[selected[1]]
        : undefined
    return (
        <div className={styles.multiRuleEditor}>
            {props.value.map((__value, index) => {
                const group = () => __value
                return (
                    <Fragment key={index}>
                        {
                            <>
                                {index > 0 ? (
                                    <>
                                        <div
                                            className={styles.and}
                                        >{t`AND`}</div>
                                    </>
                                ) : null}
                                <div className={styles.block}>
                                    <RuleBlockContent
                                        value={group()}
                                        onChange={(group) =>
                                            onBlockChange(group, index)
                                        }
                                        onEdit={(i) => setEditing([index, i])}
                                        disabled={props.disabled}
                                    />
                                </div>
                            </>
                        }
                    </Fragment>
                )
            })}
            {!props.disabled ? (
                <>
                    <Button
                        className={styles.addAnd}
                        kind="outline"
                        onClick={onAdd}
                    >
                        {t`Add AND rule`}
                    </Button>
                </>
            ) : null}
            {editingRule && (
                <Modal
                    visible
                    title={t`Ruleset`}
                    onClose={() => setEditing(null)}
                    backdropDismiss
                >
                    <div className={styles.ruleBuilderTitle}>{t`Ruleset`}</div>
                    <RuleEditor
                        className={styles.ruleEditor}
                        value={editingRule.rules}
                        onChange={onRulesChange}
                        disabled={props.disabled}
                    />
                </Modal>
            )}
        </div>
    )
}
export default MultiRuleEditor
