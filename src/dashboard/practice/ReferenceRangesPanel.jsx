import React, { useState, useMemo } from 'react'
import { LuSearch, LuX } from 'react-icons/lu'
import './ReferenceRangesPanel.css'

/**
 * ReferenceRangesPanel - A reusable component for displaying reference ranges
 * with search functionality for easy lookup
 * 
 * @param {Object} props
 * @param {Array} props.refRanges - Array of reference range groups
 * @param {boolean} props.showRef - Whether the panel content is visible
 * @param {function} props.setShowRef - Function to toggle panel visibility
 * @param {number|null} props.openGroupId - Currently open group ID
 * @param {function} props.setOpenGroupId - Function to set the open group ID
 */
export default function ReferenceRangesPanel({
    refRanges,
    showRef,
    setShowRef,
    openGroupId,
    setOpenGroupId
}) {
    const [searchQuery, setSearchQuery] = useState('')

    // Filter reference ranges based on search query
    const filteredRanges = useMemo(() => {
        if (!searchQuery.trim()) {
            return refRanges || []
        }

        const query = searchQuery.toLowerCase().trim()

        return (refRanges || []).map((grp) => {
            // Filter items within each group that match the search query
            const filteredItems = (grp.items || []).filter((item) => {
                const analyte = (item.analyte || '').toLowerCase()
                const population = (item.population || '').toLowerCase()
                const unit = (item.unit || '').toLowerCase()
                const value = (item.value_text || '').toLowerCase()

                return (
                    analyte.includes(query) ||
                    population.includes(query) ||
                    unit.includes(query) ||
                    value.includes(query)
                )
            })

            // Also check if the group title matches
            const titleMatches = (grp.title || '').toLowerCase().includes(query)

            // Include group if title matches or has matching items
            if (titleMatches || filteredItems.length > 0) {
                return {
                    ...grp,
                    items: titleMatches ? grp.items : filteredItems
                }
            }
            return null
        }).filter(Boolean)
    }, [refRanges, searchQuery])

    // When searching, auto-expand groups with matches
    const getIsOpen = (grpId) => {
        if (searchQuery.trim()) {
            return true // Auto-expand all matching groups when searching
        }
        return openGroupId === grpId
    }

    const handleGroupToggle = (grpId) => {
        if (searchQuery.trim()) {
            // When searching, allow toggling groups manually
            setOpenGroupId(prev => (prev === grpId ? null : grpId))
        } else {
            setOpenGroupId(prev => (prev === grpId ? null : grpId))
        }
    }

    const clearSearch = () => {
        setSearchQuery('')
    }

    return (
        <div className="card refcard">
            <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>Reference Ranges</div>
                <button className="btn btn--ghost btn--icon" onClick={() => setShowRef(s => !s)}>
                    {showRef ? 'Hide' : 'Show'}
                </button>
            </div>
            <div className={`refcard__content ${showRef ? 'is-open' : ''}`}>
                <div className="refcard__inner">
                    {/* Search Input */}
                    <div className="refcard__search">
                        <div className="refcard__search-wrapper">
                            <LuSearch className="refcard__search-icon" />
                            <input
                                type="text"
                                className="refcard__search-input"
                                placeholder="Search reference ranges..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    className="refcard__search-clear"
                                    onClick={clearSearch}
                                    aria-label="Clear search"
                                >
                                    <LuX size={14} />
                                </button>
                            )}
                        </div>
                        {searchQuery && (
                            <div className="refcard__search-info">
                                {filteredRanges.length === 0
                                    ? 'No results found'
                                    : `${filteredRanges.reduce((acc, grp) => acc + (grp.items?.length || 0), 0)} results found`
                                }
                            </div>
                        )}
                    </div>

                    {/* Reference Ranges Content */}
                    {filteredRanges && filteredRanges.length > 0 ? (
                        <div className="refacc">
                            {filteredRanges.map((grp) => {
                                const isOpen = getIsOpen(grp.id)
                                return (
                                    <div key={grp.id} className={`refacc__section ${isOpen ? 'is-open' : ''}`}>
                                        <button className="refacc__btn" onClick={() => handleGroupToggle(grp.id)}>
                                            <span className="refacc__title">{grp.title}</span>
                                            <span className="refacc__caret" aria-hidden>▾</span>
                                        </button>
                                        <div className="refacc__panel" style={{ maxHeight: isOpen ? 'none' : 0 }}>
                                            <div className="refcat__items">
                                                {(() => {
                                                    const groups = {}
                                                    for (const it of (grp.items || [])) {
                                                        const key = `${it.analyte}||${it.unit || ''}`
                                                        if (!groups[key]) {
                                                            groups[key] = { analyte: it.analyte, unit: it.unit || null, populations: [] }
                                                        }
                                                        const label = (it.population || '').trim()
                                                        groups[key].populations.push({
                                                            label: label,
                                                            isGeneral: label.toLowerCase() === 'general' || label === '',
                                                            value: it.value_text
                                                        })
                                                    }
                                                    const rows = Object.values(groups)
                                                    return rows.map((row, idx) => {
                                                        const specific = row.populations.filter(p => !p.isGeneral)
                                                        const general = row.populations.find(p => p.isGeneral) || null
                                                        const toShow = specific.length > 0 ? specific : (general ? [general] : [])
                                                        const weight = (label) => {
                                                            const L = (label || '').toLowerCase().trim()
                                                            if (L === 'male') return 0
                                                            if (L === 'female') return 1
                                                            return 2
                                                        }
                                                        const sortedToShow = Array.isArray(toShow)
                                                            ? [...toShow].sort((a, b) => {
                                                                const dw = weight(a.label) - weight(b.label)
                                                                if (dw !== 0) return dw
                                                                return String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' })
                                                            })
                                                            : toShow

                                                        // Highlight matching text when searching
                                                        const highlightMatch = (text) => {
                                                            if (!searchQuery.trim() || !text) return text
                                                            const query = searchQuery.toLowerCase()
                                                            const textLower = text.toLowerCase()
                                                            const index = textLower.indexOf(query)
                                                            if (index === -1) return text
                                                            return (
                                                                <>
                                                                    {text.slice(0, index)}
                                                                    <mark className="refcard__highlight">{text.slice(index, index + searchQuery.length)}</mark>
                                                                    {text.slice(index + searchQuery.length)}
                                                                </>
                                                            )
                                                        }

                                                        return (
                                                            <div key={idx} className="refrow refrow--grouped">
                                                                <div className="refrow__left">
                                                                    <div className="refrow__analyte">{highlightMatch(row.analyte)}</div>
                                                                </div>
                                                                <div className="refrow__right refrow__right--groups">
                                                                    {toShow.length === 1 && toShow[0].isGeneral ? (
                                                                        <div className="refrow__valueblock">
                                                                            <div className="refrow__valuetext">
                                                                                <span className="refrow__value">{highlightMatch(toShow[0].value)}</span>
                                                                                {row.unit && <span className="refrow__unit">{row.unit}</span>}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        sortedToShow.map((p, j) => (
                                                                            <div key={j} className="refrow__valueblock">
                                                                                {p.label && <span className="refrow__poplabel">{p.label}</span>}
                                                                                <div className="refrow__valuetext">
                                                                                    <span className="refrow__value">{highlightMatch(p.value)}</span>
                                                                                    {row.unit && <span className="refrow__unit">{row.unit}</span>}
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="refcard__empty">
                            {searchQuery.trim() ? 'No reference ranges match your search' : 'No reference ranges available'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
