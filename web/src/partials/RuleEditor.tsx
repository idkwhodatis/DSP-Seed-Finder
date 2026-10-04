import GameIcon from "../components/GameIcon"
import { type FC, Fragment } from "react"
import {
    ConditionType,
    GasType,
    OceanType,
    RuleType,
    SpectrType,
    StarType,
    VeinType,
} from "../enums"
import styles from "~styles"
import Select from "../components/Select"
import { Trash2 as IoTrash } from "lucide-react"
import Button from "../components/Button"
import NumberInput from "../components/NumberInput"
import clsx from "clsx"
import { Trans, useLingui } from "#lingui"
import {
    useRuleNames,
    useStarTypeNames,
    useGasTypeNames,
    useVeinNames,
    usePlanetTypeNames,
    useConditionTypeNames,
} from "../names"
const SelectSimpleRule: FC<{
    value?: SimpleRule
    onChange: (rule: SimpleRule) => void
    disabled?: boolean
}> = (props) => {
    const { t } = useLingui()
    const ruleNames = useRuleNames()
    return (
        <Select
            className={styles.selectRule}
            value={
                props.value?.type === RuleType.None ? undefined : props.value
            }
            onChange={props.onChange}
            isSelected={(rule) => rule.type === props.value?.type}
            options={rules}
            placeholder={t`Select...`}
            getLabel={(rule) => ruleNames[rule.type]()}
            error={!props.value || props.value?.type === RuleType.None}
            disabled={props.disabled}
        />
    )
}
const ConditionInput: FC<{
    value: Condition
    onChange: (value: Condition) => void
    disabled?: boolean
    className?: string
    error?: boolean
    emptyValue: number
    maxLength?: number
}> = (props) => {
    const conditionTypeNames = useConditionTypeNames()
    return (
        <>
            <Select
                className={styles.selectConditionType}
                value={props.value.type}
                onChange={(type) =>
                    props.onChange({
                        ...props.value,
                        type,
                    })
                }
                options={[
                    ConditionType.Gte,
                    ConditionType.Lte,
                    ConditionType.Eq,
                ]}
                getLabel={(type) => conditionTypeNames[type]()}
                disabled={props.disabled}
            />{" "}
            <NumberInput
                className={props.className}
                value={props.value.value}
                onChange={(value) =>
                    props.onChange({
                        ...props.value,
                        value,
                    })
                }
                emptyValue={props.emptyValue}
                disabled={props.disabled}
                maxLength={props.maxLength}
                error={props.error}
            />
        </>
    )
}
const EditLuminosity: FC<{
    value: Rule.Luminosity
    onChange: (value: Rule.Luminosity) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    return (
        <Trans>
            Is{" "}
            <ConditionInput
                className={styles.inputLuminosity}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0 || condition().value >= 3}
                disabled={props.disabled}
            />
            L
        </Trans>
    )
}
const EditDysonRadius: FC<{
    value: Rule.DysonRadius
    onChange: (value: Rule.DysonRadius) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    return (
        <Trans>
            Is{" "}
            <ConditionInput
                className={styles.inputDyson}
                maxLength={6}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />
            m
        </Trans>
    )
}
const EditAverageVeinAmount: FC<{
    value: Rule.AverageVeinAmount
    onChange: (value: Rule.AverageVeinAmount) => void
    disabled?: boolean
}> = (props) => {
    const { t } = useLingui()
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    const veinNames = useVeinNames()
    return (
        <>
            <Trans>
                Has{" "}
                <Select
                    className={styles.selectVein}
                    value={props.value.vein}
                    onChange={(vein) =>
                        props.onChange({
                            ...props.value,
                            vein,
                        })
                    }
                    options={veins}
                    getLabel={(vein) => (
                        <>
                            <GameIcon vein={vein} />
                            {veinNames[vein]()}
                        </>
                    )}
                    disabled={props.disabled}
                />{" "}
                and the{" "}
                <Select
                    className={styles.selectVeinUseActual}
                    value={!!props.value.useActual}
                    onChange={(useActual) =>
                        props.onChange({
                            ...props.value,
                            useActual,
                        })
                    }
                    options={[false, true]}
                    getLabel={(useActual) =>
                        useActual ? t`actual` : t`estimated`
                    }
                    disabled={props.disabled}
                />{" "}
                amount is{" "}
                <ConditionInput
                    className={styles.inputVein}
                    value={condition()}
                    onChange={setCondition}
                    emptyValue={-1}
                    error={condition().value <= 0}
                    disabled={props.disabled}
                />
            </Trans>
            {props.value.vein === VeinType.Oil ? " /s" : " "}
            {"  "}
            {props.value.useActual ? (
                <>
                    <br />
                    <span
                        className={styles.veinWarning}
                    >{t`Warning: using actual values is much slower.`}</span>
                </>
            ) : null}
        </>
    )
}
const EditSpectr: FC<{
    value: Rule.Spectr
    onChange: (value: Rule.Spectr) => void
    disabled?: boolean
}> = (props) => {
    return (
        <Trans>
            Is a{" "}
            <Select
                className={styles.selectSpectr}
                value={props.value.spectr[0]}
                onChange={(spectr) =>
                    props.onChange({
                        ...props.value,
                        spectr: [spectr],
                    })
                }
                options={spectrs}
                getLabel={(spectr) => spectr}
                disabled={props.disabled}
            />{" "}
            type star
        </Trans>
    )
}
const EditTidalLockCount: FC<{
    value: Rule.TidalLockCount
    onChange: (value: Rule.TidalLockCount) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    return (
        <Trans>
            Has{" "}
            <ConditionInput
                className={styles.inputCount}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />{" "}
            tidally locked planets
        </Trans>
    )
}
const EditOceanType: FC<{
    value: Rule.OceanType
    onChange: (value: Rule.OceanType) => void
    disabled?: boolean
}> = (props) => {
    const { t } = useLingui()
    return (
        <Trans>
            Has planets with{" "}
            <Select
                className={styles.selectOcean}
                value={props.value.oceanType}
                onChange={(oceanType) =>
                    props.onChange({
                        ...props.value,
                        oceanType,
                    })
                }
                options={oceans}
                getLabel={(oceanType) => (
                    <>
                        <GameIcon ocean={oceanType} />
                        {oceanType === OceanType.Water
                            ? t`Water`
                            : t`Sulfuric Acid`}
                    </>
                )}
                disabled={props.disabled}
            />{" "}
            Ocean
        </Trans>
    )
}
const EditStarType: FC<{
    value: Rule.StarType
    onChange: (value: Rule.StarType) => void
    disabled?: boolean
}> = (props) => {
    const starTypeNames = useStarTypeNames()
    return (
        <Trans>
            Is a{" "}
            <Select
                className={styles.selectStarType}
                value={props.value.starType[0]}
                onChange={(starType) =>
                    props.onChange({
                        ...props.value,
                        starType: [starType],
                    })
                }
                options={starTypes}
                getLabel={(starType) => starTypeNames[starType]()}
                disabled={props.disabled}
            />
        </Trans>
    )
}
const EditGasCount: FC<{
    value: Rule.GasCount
    onChange: (value: Rule.GasCount) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    const { t } = useLingui()
    return (
        <Trans>
            Has{" "}
            <ConditionInput
                className={styles.inputCount}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />{" "}
            <Select
                className={styles.selectGas}
                value={props.value.ice}
                onChange={(ice) =>
                    props.onChange({
                        ...props.value,
                        ice,
                    })
                }
                options={[null, false, true]}
                getLabel={(ice) =>
                    ice === null ? t`gas/ice` : ice ? t`ice` : t`gas`
                }
                disabled={props.disabled}
            />{" "}
            giant(s)
        </Trans>
    )
}
const EditSatelliteCount: FC<{
    value: Rule.SatelliteCount
    onChange: (value: Rule.SatelliteCount) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    return (
        <Trans>
            Has{" "}
            <ConditionInput
                className={styles.inputCount}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />{" "}
            satellite(s)
        </Trans>
    )
}
const EditPlanetCount: FC<{
    value: Rule.PlanetCount
    onChange: (value: Rule.PlanetCount) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    const { t } = useLingui()
    return (
        <Trans>
            Has{" "}
            <ConditionInput
                className={styles.inputCount}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 1}
                disabled={props.disabled}
            />{" "}
            planets,{" "}
            <Select
                className={styles.selectGasType}
                value={props.value.excludeGiant}
                onChange={(excludeGiant) =>
                    props.onChange({
                        ...props.value,
                        excludeGiant,
                    })
                }
                options={[false, true]}
                getLabel={(excludeGiant) =>
                    excludeGiant ? t`excluding` : t`including`
                }
                disabled={props.disabled}
            />{" "}
            gas/ice giants.
        </Trans>
    )
}
const EditBirthDistance: FC<{
    value: Rule.BirthDistance
    onChange: (value: Rule.BirthDistance) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    return (
        <Trans>
            Is{" "}
            <ConditionInput
                className={styles.inputDistance}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />
            ly away from the Starting system
        </Trans>
    )
}
const EditXDistance: FC<{
    value: Rule.XDistance
    onChange: (value: Rule.XDistance) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    const { t } = useLingui()
    return (
        <Trans>
            Is{" "}
            <ConditionInput
                className={styles.inputDistance}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />{" "}
            ly away from{" "}
            <Select
                className={styles.selectAllOrAny}
                value={!!props.value.all}
                onChange={(all) =>
                    props.onChange({
                        ...props.value,
                        all,
                    })
                }
                options={[false, true]}
                getLabel={(all) => (all ? t`all` : t`any`)}
                disabled={props.disabled}
            />{" "}
            black hole / neutron star.
        </Trans>
    )
}
const EditSpectrDistance: FC<{
    value: Rule.SpectrDistance
    onChange: (value: Rule.SpectrDistance) => void
    disabled?: boolean
}> = (props) => {
    const countCondition = () => props.value.countCondition
    const setCountCondition = (countCondition: Condition) =>
        props.onChange({
            ...props.value,
            countCondition,
        })
    const distanceCondition = () => props.value.distanceCondition
    const setDistanceCondition = (distanceCondition: Condition) =>
        props.onChange({
            ...props.value,
            distanceCondition,
        })
    return (
        <Trans>
            Has{" "}
            <ConditionInput
                className={styles.inputCount}
                value={countCondition()}
                onChange={setCountCondition}
                emptyValue={-1}
                error={countCondition().value <= 0}
                disabled={props.disabled}
            />{" "}
            <Select
                className={styles.selectSpectr}
                value={props.value.spectr}
                onChange={(spectr) =>
                    props.onChange({
                        ...props.value,
                        spectr,
                    })
                }
                options={spectrs}
                getLabel={(spectr) => spectr}
                disabled={props.disabled}
            />{" "}
            type stars that are{" "}
            <ConditionInput
                className={styles.inputDistance}
                value={distanceCondition()}
                onChange={setDistanceCondition}
                emptyValue={-1}
                error={distanceCondition().value <= 0}
                disabled={props.disabled}
            />{" "}
            ly away.
        </Trans>
    )
}
const EditGasRate: FC<{
    value: Rule.GasRate
    onChange: (value: Rule.GasRate) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    const gasTypeNames = useGasTypeNames()
    return (
        <Trans>
            Has{" "}
            <Select
                className={styles.selectGasType}
                value={props.value.gasType}
                onChange={(gasType) =>
                    props.onChange({
                        ...props.value,
                        gasType,
                    })
                }
                options={gasTypes}
                getLabel={(gasType) => (
                    <>
                        <GameIcon gas={gasType} />
                        {gasTypeNames[gasType]()}
                    </>
                )}
                disabled={props.disabled}
            />{" "}
            and{" "}
            <ConditionInput
                className={styles.inputGasRate}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />
            /s of it
        </Trans>
    )
}
const EditPlanetInDysonCount: FC<{
    value: Rule.PlanetInDysonCount
    onChange: (value: Rule.PlanetInDysonCount) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    const { t } = useLingui()
    return (
        <Trans>
            Has{" "}
            <ConditionInput
                className={styles.inputCount}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value <= 0}
                disabled={props.disabled}
            />{" "}
            planet(s) within Max dyson sphere radius,{" "}
            <Select
                className={styles.selectGasType}
                value={props.value.includeGiant}
                onChange={(includeGiant) =>
                    props.onChange({
                        ...props.value,
                        includeGiant,
                    })
                }
                options={[false, true]}
                getLabel={(includeGiant) =>
                    includeGiant ? t`including` : t`excluding`
                }
                disabled={props.disabled}
            />{" "}
            gas/ice giants.
        </Trans>
    )
}
const themeIds = [
    16, 14, 19, 11, 7, 10, 12, 17, 24, 9, 1, 20, 23, 25, 15, 18, 22, 6, 13, 8,
]
const EditThemeId: FC<{
    value: Rule.ThemeId
    onChange: (value: Rule.ThemeId) => void
    disabled?: boolean
}> = (props) => {
    const planetTypes = usePlanetTypeNames()
    const { t } = useLingui()
    return (
        <Trans>
            <Select
                className={styles.selectThemeNegate}
                value={!!props.value.negate}
                onChange={(negate) =>
                    props.onChange({
                        ...props.value,
                        negate,
                    })
                }
                options={[false, true]}
                getLabel={(negate) => (negate ? t`Does not have` : t`Has`)}
                disabled={props.disabled}
            />{" "}
            a{" "}
            <Select
                className={styles.selectPlanetType}
                value={props.value.themeIds[0]!}
                onChange={(themeId) =>
                    props.onChange({
                        ...props.value,
                        themeIds: [themeId],
                    })
                }
                options={themeIds}
                getLabel={(themeId) => planetTypes[themeId]!()}
                disabled={props.disabled}
            />{" "}
            planet.
        </Trans>
    )
}
const EditHiveCount: FC<{
    value: Rule.HiveCount
    onChange: (value: Rule.HiveCount) => void
    disabled?: boolean
}> = (props) => {
    const condition = () => props.value.condition
    const setCondition = (condition: Condition) =>
        props.onChange({
            ...props.value,
            condition,
        })
    const { t } = useLingui()
    return (
        <Trans>
            <Select
                className={styles.selectInitialOrMax}
                value={!!props.value.initial}
                onChange={(initial) =>
                    props.onChange({
                        ...props.value,
                        initial,
                    })
                }
                options={[true, false]}
                getLabel={(initial) => (initial ? t`Initial` : t`Max`)}
                disabled={props.disabled}
            />{" "}
            number of hives is{" "}
            <ConditionInput
                className={styles.inputCount}
                value={condition()}
                onChange={setCondition}
                emptyValue={-1}
                error={condition().value < 0 || condition().value > 6}
                disabled={props.disabled}
            />
            .
        </Trans>
    )
}
const EditSimpleRule: FC<{
    value: SimpleRule
    onChange: (value: SimpleRule) => void
    disabled?: boolean
}> = (props) => {
    const { t } = useLingui()
    const value = props.value
    const renderEditor = () => {
        switch (value.type) {
            case RuleType.Luminosity:
                return <EditLuminosity {...props} value={value} />
            case RuleType.DysonRadius:
                return <EditDysonRadius {...props} value={value} />
            case RuleType.AverageVeinAmount:
                return <EditAverageVeinAmount {...props} value={value} />
            case RuleType.Spectr:
                return <EditSpectr {...props} value={value} />
            case RuleType.TidalLockCount:
                return <EditTidalLockCount {...props} value={value} />
            case RuleType.OceanType:
                return <EditOceanType {...props} value={value} />
            case RuleType.StarType:
                return <EditStarType {...props} value={value} />
            case RuleType.GasCount:
                return <EditGasCount {...props} value={value} />
            case RuleType.SatelliteCount:
                return <EditSatelliteCount {...props} value={value} />
            case RuleType.PlanetCount:
                return <EditPlanetCount {...props} value={value} />
            case RuleType.BirthDistance:
                return <EditBirthDistance {...props} value={value} />
            case RuleType.XDistance:
                return <EditXDistance {...props} value={value} />
            case RuleType.SpectrDistance:
                return <EditSpectrDistance {...props} value={value} />
            case RuleType.GasRate:
                return <EditGasRate {...props} value={value} />
            case RuleType.PlanetInDysonCount:
                return <EditPlanetInDysonCount {...props} value={value} />
            case RuleType.ThemeId:
                return <EditThemeId {...props} value={value} />
            case RuleType.HiveCount:
                return <EditHiveCount {...props} value={value} />
            case RuleType.Birth:
                return (
                    <div
                        className={styles.birth}
                    >{t`Is the Starting system`}</div>
                )
            default:
                return null
        }
    }
    return <div className={styles.editRow}>{renderEditor()}</div>
}
const DeleteButton: FC<{
    onDelete: () => void
}> = (props) => {
    const { t } = useLingui()
    return (
        <button
            type="button"
            aria-label={t`Delete rule`}
            className={styles.delete}
            style={{ background: "transparent", border: 0 }}
            onClick={() => props.onDelete()}
        >
            <IoTrash />
        </button>
    )
}
const EmptyRow: FC<{
    onChange: (rule: SimpleRule) => void
    onDelete?: () => void
    disabled?: boolean
}> = (props) => {
    return (
        <div className={styles.row}>
            <SelectSimpleRule
                onChange={props.onChange}
                disabled={props.disabled}
            />
            {!!props.onDelete && !props.disabled ? (
                <>
                    <DeleteButton onDelete={() => props.onDelete?.()} />
                </>
            ) : null}
        </div>
    )
}
const RuleBlockContent: FC<{
    value: SimpleRule[]
    onChange: (value: SimpleRule[]) => void
    disabled?: boolean
    onDelete?: () => void
}> = (props) => {
    function onChange(rule: SimpleRule, index: number) {
        props.onChange(props.value.map((v, i) => (i === index ? rule : v)))
    }
    function onDelete(index: number) {
        props.onChange(props.value.filter((_, i) => i !== index))
    }
    function onAdd() {
        props.onChange([
            ...props.value,
            {
                type: RuleType.None,
            },
        ])
    }
    const { t } = useLingui()
    return props.value.length > 0 ? (
        <>
            {props.value.map((_item, index) => {
                const item = () => _item
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
                                    <SelectSimpleRule
                                        value={item()}
                                        onChange={(rule) =>
                                            onChange(rule, index)
                                        }
                                        disabled={props.disabled}
                                    />
                                    <EditSimpleRule
                                        value={item()}
                                        onChange={(rule) =>
                                            onChange(rule, index)
                                        }
                                        disabled={props.disabled}
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
    ) : (
        <EmptyRow
            onChange={(rule) => props.onChange([rule])}
            onDelete={props.onDelete}
            disabled={props.disabled}
        />
    )
}
const RuleEditor: FC<{
    className?: string
    value: SimpleRule[][]
    onChange: (value: SimpleRule[][]) => void
    disabled?: boolean
}> = (props) => {
    function onDelete(index: number) {
        props.onChange(props.value.filter((_, i) => i !== index))
    }
    function onBlockChange(group: SimpleRule[], index: number) {
        if (group.length > 0) {
            props.onChange(props.value.map((v, i) => (i === index ? group : v)))
        } else {
            onDelete(index)
        }
    }
    function onAdd() {
        props.onChange([...props.value, []])
    }
    const { t } = useLingui()
    return (
        <div className={clsx(styles.ruleBuilder, props.className)}>
            {props.value.length > 0 ? (
                <>
                    {props.value.map((_item2, index) => {
                        const group = () => _item2
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
                                                disabled={props.disabled}
                                                onDelete={
                                                    props.value.length > 1
                                                        ? () => onDelete(index)
                                                        : undefined
                                                }
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
                </>
            ) : (
                <div className={styles.block}>
                    <EmptyRow
                        onChange={(rule) => props.onChange([[rule]])}
                        disabled={props.disabled}
                    />
                </div>
            )}
        </div>
    )
}
export default RuleEditor
const rules: SimpleRule[] = [
    {
        type: RuleType.BirthDistance,
        condition: {
            type: ConditionType.Lte,
            value: 0,
        },
    },
    {
        type: RuleType.SpectrDistance,
        spectr: SpectrType.O,
        countCondition: {
            type: ConditionType.Gte,
            value: 1,
        },
        distanceCondition: {
            type: ConditionType.Lte,
            value: 0,
        },
    },
    {
        type: RuleType.XDistance,
        condition: {
            type: ConditionType.Lte,
            value: 0,
        },
        all: false,
    },
    {
        type: RuleType.GasCount,
        ice: null,
        condition: {
            type: ConditionType.Gte,
            value: 1,
        },
    },
    {
        type: RuleType.GasRate,
        gasType: GasType.Hydrogen,
        condition: {
            type: ConditionType.Gte,
            value: 0,
        },
    },
    {
        type: RuleType.HiveCount,
        initial: true,
        condition: {
            type: ConditionType.Lte,
            value: 1,
        },
    },
    {
        type: RuleType.Luminosity,
        condition: {
            type: ConditionType.Gte,
            value: 2,
        },
    },
    {
        type: RuleType.DysonRadius,
        condition: {
            type: ConditionType.Gte,
            value: 0,
        },
    },
    {
        type: RuleType.OceanType,
        oceanType: OceanType.Water,
    },
    {
        type: RuleType.PlanetCount,
        condition: {
            type: ConditionType.Gte,
            value: 2,
        },
        excludeGiant: false,
    },
    {
        type: RuleType.ThemeId,
        themeIds: [1],
    },
    {
        type: RuleType.PlanetInDysonCount,
        includeGiant: false,
        condition: {
            type: ConditionType.Gte,
            value: 1,
        },
    },
    {
        type: RuleType.SatelliteCount,
        condition: {
            type: ConditionType.Gte,
            value: 1,
        },
    },
    {
        type: RuleType.Spectr,
        spectr: [SpectrType.O],
    },
    {
        type: RuleType.Birth,
    },
    {
        type: RuleType.TidalLockCount,
        condition: {
            type: ConditionType.Gte,
            value: 1,
        },
    },
    {
        type: RuleType.StarType,
        starType: [StarType.MainSeqStar],
    },
    {
        type: RuleType.AverageVeinAmount,
        vein: VeinType.Iron,
        condition: {
            type: ConditionType.Gte,
            value: 0,
        },
    },
]
const veins: VeinType[] = [
    VeinType.Iron,
    VeinType.Copper,
    VeinType.Silicium,
    VeinType.Titanium,
    VeinType.Stone,
    VeinType.Coal,
    VeinType.Oil,
    VeinType.Fireice,
    VeinType.Diamond,
    VeinType.Fractal,
    VeinType.Crysrub,
    VeinType.Grat,
    VeinType.Bamboo,
    VeinType.Mag,
]
const spectrs: SpectrType[] = [
    SpectrType.O,
    SpectrType.B,
    SpectrType.A,
    SpectrType.F,
    SpectrType.G,
    SpectrType.K,
    SpectrType.M,
    SpectrType.X,
]
const oceans: OceanType[] = [OceanType.Water, OceanType.Sulfur]
const starTypes: StarType[] = [
    StarType.MainSeqStar,
    StarType.GiantStar,
    StarType.WhiteDwarf,
    StarType.BlackHole,
    StarType.NeutronStar,
]
const gasTypes: GasType[] = [
    GasType.Hydrogen,
    GasType.Deuterium,
    GasType.Fireice,
]
